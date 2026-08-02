/**
 * Camera-triggered classification — DIGITAL_SENSOR_SIMULATION.
 *
 * Classification fires only when a product body enters the physical camera
 * scan volume. Playlist / spawn must not assign a sorter route.
 */

import { classifyItem } from './classifier';
import type { ClassificationResult, Item } from './types';
import { BELT_TOP_Y, CONVEYOR_WIDTH_M, ZONES } from './physicalLayout';
import {
  categoryToPhysicalRoute,
  physicalRouteToActiveDiverter,
  type PhysicalRoute,
} from './pusherMotion';

export const CAMERA_VOLUME_ID = 'camera-scan-volume';

/** Physical sensor volume under the visible camera assembly (sensor, no response). */
export const CAMERA_SCAN_VOLUME = {
  id: CAMERA_VOLUME_ID,
  centerX: ZONES.CAMERA.x,
  centerY: BELT_TOP_Y + 0.16,
  centerZ: 0,
  halfX: 0.32,
  halfY: 0.22,
  halfZ: CONVEYOR_WIDTH_M / 2 + 0.04,
} as const;

export type ClassificationLifecycle = 'UNKNOWN' | 'SCANNING' | 'CLASSIFIED';

export interface CameraMeasurement {
  productId: string;
  measuredLengthMm: number;
  measuredWidthMm: number;
  measuredHeightMm: number;
  roundnessK: number;
  capturedAtPhysicsStep: number;
  cameraVolumeId: string;
  provenance: 'DIGITAL_SENSOR_SIMULATION';
}

export interface ClassificationEvent {
  productId: string;
  lifecycle: ClassificationLifecycle;
  measurement: CameraMeasurement | null;
  result: ClassificationResult | null;
  category: 'B' | 'C' | 'D' | null;
  physicalRoute: PhysicalRoute | 'NONE';
  activeDiverter: 'LEFT' | 'RIGHT' | 'NONE';
  classifiedAtPhysicsStep: number | null;
}

const classified = new Map<string, ClassificationEvent>();
let physicsStepCounter = 0;
let routeWritesBeforeCameraEntry = 0;

export function advanceCameraPhysicsStep(): number {
  physicsStepCounter += 1;
  return physicsStepCounter;
}

export function getCameraPhysicsStep(): number {
  return physicsStepCounter;
}

export function resetCameraClassifications(): void {
  classified.clear();
  physicsStepCounter = 0;
  routeWritesBeforeCameraEntry = 0;
}

export function getRouteWritesBeforeCameraEntry(): number {
  return routeWritesBeforeCameraEntry;
}

export function isInsideCameraVolume(position: [number, number, number]): boolean {
  const [x, y, z] = position;
  const v = CAMERA_SCAN_VOLUME;
  return (
    Math.abs(x - v.centerX) <= v.halfX
    && Math.abs(y - v.centerY) <= v.halfY
    && Math.abs(z - v.centerZ) <= v.halfZ
  );
}

export function measureProductAtCamera(
  productId: string,
  item: Item,
  physicsStep: number,
): CameraMeasurement {
  const d = item.dimensionsMm;
  return {
    productId,
    measuredLengthMm: d.width,
    measuredWidthMm: d.depth,
    measuredHeightMm: d.height,
    roundnessK: item.roundness,
    capturedAtPhysicsStep: physicsStep,
    cameraVolumeId: CAMERA_VOLUME_ID,
    provenance: 'DIGITAL_SENSOR_SIMULATION',
  };
}

export function getClassificationEvent(productId: string): ClassificationEvent | null {
  return classified.get(productId) ?? null;
}

export function getClassificationLifecycle(productId: string): ClassificationLifecycle {
  return classified.get(productId)?.lifecycle ?? 'UNKNOWN';
}

/**
 * Request a mechanical route command. Throws in DEV if requested before a
 * valid classification event; in production keeps diverters neutral.
 */
export function requestRouteCommand(
  productId: string,
  opts?: { allowBeforeClassification?: boolean },
): ClassificationEvent {
  const ev = classified.get(productId);
  if (ev?.lifecycle === 'CLASSIFIED' && ev.category) {
    return ev;
  }
  routeWritesBeforeCameraEntry += 1;
  if (import.meta.env.DEV && !opts?.allowBeforeClassification) {
    throw new Error(
      `[cameraClassification] route command before classification for ${productId}`,
    );
  }
  return {
    productId,
    lifecycle: 'UNKNOWN',
    measurement: null,
    result: null,
    category: null,
    physicalRoute: 'NONE',
    activeDiverter: 'NONE',
    classifiedAtPhysicsStep: null,
  };
}

/**
 * Attempt classification when body is inside the camera volume.
 * Fires once per productId. Returns the event (new or existing).
 */
export function tryClassifyAtCamera(input: {
  productId: string;
  item: Item;
  position: [number, number, number];
  physicsStep?: number;
}): ClassificationEvent {
  const existing = classified.get(input.productId);
  if (existing?.lifecycle === 'CLASSIFIED') {
    return existing;
  }

  const inside = isInsideCameraVolume(input.position);
  if (!inside) {
    const waiting: ClassificationEvent = existing ?? {
      productId: input.productId,
      lifecycle: 'UNKNOWN',
      measurement: null,
      result: null,
      category: null,
      physicalRoute: 'NONE',
      activeDiverter: 'NONE',
      classifiedAtPhysicsStep: null,
    };
    classified.set(input.productId, waiting);
    return waiting;
  }

  const step = input.physicsStep ?? advanceCameraPhysicsStep();
  const measurement = measureProductAtCamera(input.productId, input.item, step);
  const result = classifyItem(input.item);
  const category = result.category as 'B' | 'C' | 'D';
  const physicalRoute = categoryToPhysicalRoute(category);
  const event: ClassificationEvent = {
    productId: input.productId,
    lifecycle: 'CLASSIFIED',
    measurement,
    result,
    category,
    physicalRoute,
    activeDiverter: physicalRouteToActiveDiverter(physicalRoute),
    classifiedAtPhysicsStep: step,
  };
  classified.set(input.productId, event);

  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      __CAMERA_CLASSIFICATION__?: ClassificationEvent;
      __CLASSIFICATION_EVENTS__?: ClassificationEvent[];
    };
    w.__CAMERA_CLASSIFICATION__ = event;
    w.__CLASSIFICATION_EVENTS__ = [...(w.__CLASSIFICATION_EVENTS__ ?? []), event].slice(-32);
    window.dispatchEvent(new CustomEvent('camera-classification', { detail: event }));
  }
  return event;
}

/** Publish live UI snapshot without assigning a mechanical route prematurely. */
export function peekClassificationUi(productId: string | null): {
  status: string;
  category: string;
  route: string;
} {
  if (!productId) {
    return { status: 'Ожидание сканирования', category: '—', route: 'Не определён' };
  }
  const ev = classified.get(productId);
  if (!ev || ev.lifecycle === 'UNKNOWN') {
    return { status: 'Ожидание сканирования', category: '—', route: 'Не определён' };
  }
  if (ev.lifecycle === 'SCANNING') {
    return { status: 'Сканирование', category: '—', route: 'Не определён' };
  }
  const routeLabel =
    ev.physicalRoute === 'PHYSICAL_LEFT' ? 'Влево'
      : ev.physicalRoute === 'PHYSICAL_RIGHT' ? 'Вправо'
        : ev.physicalRoute === 'STRAIGHT' ? 'Прямо'
          : 'Не определён';
  return {
    status: 'Классифицировано',
    category: ev.category ?? '—',
    route: routeLabel,
  };
}
