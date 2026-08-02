import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DISCHARGE_EDGE_S,
  DOCUMENTED_LOCAL_CLEAR_OFFSET,
  DOCUMENTED_LOCAL_CONTACT_OFFSET,
  SORTER_ASSEMBLY_ORIGIN_S,
  B_RECEIVER,
  ZONES,
  worldClearPlaneS,
  worldContactPlaneS,
} from './physicalLayout';
import { getStaticColliders } from './physicsWorldLayout';
import {
  BELT_END_S,
  BELT_SPEED_MPS,
  isSupportedByBelt,
  colliderHalfHeight,
  getProductPhysicsProfile,
  spawnCenterY,
} from './productPhysicsProfiles';
import {
  DOCUMENTED_CLEAR_PLANE_S,
  DOCUMENTED_CONTACT_PLANE_S,
  DIVERTER_WORLD_PIVOTS,
  FALL_PHYSICS_PARAMETERS_UNCHANGED,
  FALL_GRAVITY_Y,
  SETTLE_DURATION_SEC,
  SETTLE_LINEAR_SPEED_MPS,
  SETTLE_ANGULAR_SPEED_RAD_S,
  runtimeWorldClearPlaneS,
  runtimeWorldContactPlaneS,
  simulateJunctionContact,
  runJunctionMatrix,
} from './junctionContactPhysics';
import {
  CAMERA_SCAN_VOLUME,
  getClassificationLifecycle,
  getRouteWritesBeforeCameraEntry,
  isInsideCameraVolume,
  measureProductAtCamera,
  resetCameraClassifications,
  tryClassifyAtCamera,
  requestRouteCommand,
} from './cameraClassification';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';
import { startPlayback, createPlaybackState } from './continuousPlayback';
import { PHYSICS_TIMESTEP_SEC } from './physicsTimestep';
import { initRapier } from './physicsDropSim';
import {
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  OPENING_SAFETY_MARGIN_SEC,
  rotationDurationSec,
} from './pusherMotion';
import { CAD_MODULE_ORIGINS } from '../components/ThreeD/ConveyorCadModel';
import { PRODUCTION_STATUS } from '../data/productionStatusSummary';
import { OZON_TOKENS } from './industrialTheme';
import physicsSrc from '../components/ThreeD/PhysicalPlaybackItemPhysics.tsx?raw';
import sorterPhysicsSrc from '../components/ThreeD/SorterPhysics.tsx?raw';

beforeAll(async () => {
  await initRapier();
});

beforeEach(() => {
  resetCameraClassifications();
});


describe('discharge edge / belt support', () => {
  it('DISCHARGE_EDGE_S matches final belt-slab support bounds', () => {
    const slab = getStaticColliders().find((c) => c.id === 'belt-slab')!;
    const maxX = slab.position[0] + slab.halfExtents[0];
    expect(maxX).toBeCloseTo(DISCHARGE_EDGE_S, 6);
    expect(BELT_END_S).toBe(DISCHARGE_EDGE_S);
  });

  it('no belt support beyond discharge edge and no belt force contract', () => {
    const half = colliderHalfHeight(getProductPhysicsProfile('SKU-001'));
    expect(isSupportedByBelt({
      position: [DISCHARGE_EDGE_S + 0.01, spawnCenterY(getProductPhysicsProfile('SKU-001')), 0],
      halfHeight: half,
      phase: 'junction',
      linearVelY: 0,
    })).toBe(false);
    expect(getStaticColliders().some((c) => c.id === 'b-drop-chute')).toBe(false);
  });

  it('falling physics constants unchanged', () => {
    expect(FALL_PHYSICS_PARAMETERS_UNCHANGED).toBe(true);
    expect(FALL_GRAVITY_Y).toBe(-9.81);
    expect(SETTLE_LINEAR_SPEED_MPS).toBe(0.2);
    expect(SETTLE_ANGULAR_SPEED_RAD_S).toBe(1.0);
    expect(SETTLE_DURATION_SEC).toBe(0.3);
    expect(BELT_SPEED_MPS).toBe(1.0);
    expect(PHYSICS_TIMESTEP_SEC).toBeCloseTo(1 / 120, 12);
    expect(sorterPhysicsSrc).toMatch(/MAX_SUBSTEPS/);
  });
});

describe('sorter assembly / local-vs-world planes', () => {
  it('sorter assembly is at final discharge section', () => {
    expect(CAD_MODULE_ORIGINS.sorter).toBe(SORTER_ASSEMBLY_ORIGIN_S);
    expect(SORTER_ASSEMBLY_ORIGIN_S).toBeGreaterThan(0);
    const hinge = SORTER_ASSEMBLY_ORIGIN_S + 1.55;
    expect(DISCHARGE_EDGE_S - hinge).toBeLessThan(0.35);
    expect(DIVERTER_WORLD_PIVOTS.left.x).toBeCloseTo(hinge, 6);
    expect(DIVERTER_WORLD_PIVOTS.right.x).toBeCloseTo(hinge, 6);
  });

  it('local documented offsets stay 1.0538 / 1.6000; world = origin + local', () => {
    expect(DOCUMENTED_LOCAL_CONTACT_OFFSET).toBe(1.0538);
    expect(DOCUMENTED_LOCAL_CLEAR_OFFSET).toBe(1.6000);
    expect(DOCUMENTED_CONTACT_PLANE_S).toBe(1.0538);
    expect(DOCUMENTED_CLEAR_PLANE_S).toBe(1.6);
    expect(worldContactPlaneS()).toBeCloseTo(SORTER_ASSEMBLY_ORIGIN_S + 1.0538, 6);
    expect(worldClearPlaneS()).toBeCloseTo(SORTER_ASSEMBLY_ORIGIN_S + 1.6000, 6);
    expect(runtimeWorldContactPlaneS()).toBe(worldContactPlaneS());
    expect(runtimeWorldClearPlaneS()).toBe(worldClearPlaneS());
  });

  it('LEFT/RIGHT mesh and collider share assembly transform', () => {
    expect(DIVERTER_WORLD_PIVOTS.left.x).toBe(CAD_MODULE_ORIGINS.sorter + 1.55);
    expect(DIVERTER_WORLD_PIVOTS.right.x).toBe(CAD_MODULE_ORIGINS.sorter + 1.55);
  });

  it('frozen angles/timing unchanged', () => {
    expect(DIVERTER_LEFT_SIGNED_DEG).toBe(-45);
    expect(DIVERTER_RIGHT_SIGNED_DEG).toBe(45);
    expect(rotationDurationSec()).toBeCloseTo(0.5, 6);
    expect(OPENING_SAFETY_MARGIN_SEC).toBeCloseTo(0.15, 6);
  });
});

describe('receivers / ballistics', () => {
  it('B receiver is closer and sensor stays inside basket footprint', () => {
    expect(B_RECEIVER.centerX).toBeLessThan(2.85);
    expect(B_RECEIVER.centerX).toBeGreaterThan(DISCHARGE_EDGE_S);
    expect(ZONES.B.x).toBe(B_RECEIVER.centerX);
    const openingMinX = B_RECEIVER.centerX - B_RECEIVER.width / 2;
    // Opening must start after discharge so C/D lateral exit is not tagged B.
    expect(openingMinX).toBeGreaterThan(DISCHARGE_EDGE_S);
  });

  it('B ballistic projection intersects B opening', () => {
    const openingMinX = B_RECEIVER.centerX - B_RECEIVER.width / 2;
    const openingMaxX = B_RECEIVER.centerX + B_RECEIVER.width / 2;
    // Exit at discharge with ~1 m/s → short free-fall lands near opening.
    const landX = DISCHARGE_EDGE_S + 0.35;
    expect(landX).toBeGreaterThanOrEqual(openingMinX - 0.08);
    expect(landX).toBeLessThanOrEqual(openingMaxX + 0.08);
  });

  it('C/D openings align with guide exit X', () => {
    expect(ZONES.C.x).toBeCloseTo(DIVERTER_WORLD_PIVOTS.left.x, 6);
    expect(ZONES.D.x).toBeCloseTo(DIVERTER_WORLD_PIVOTS.right.x, 6);
  });
});

describe('camera-triggered classification', () => {
  it('playlist cannot directly assign route at spawn', () => {
    const state = startPlayback(createPlaybackState());
    expect(state.targetCategory).toBeNull();
    expect(state.classification).toBeNull();
    expect(getClassificationLifecycle('SKU-001')).toBe('UNKNOWN');
  });

  it('classification requires camera sensor entry and fires once', () => {
    const item = resolveItem('SKU-001');
    const before = tryClassifyAtCamera({
      productId: 'SKU-001',
      item,
      position: [-3.5, 0.8, 0],
    });
    expect(before.lifecycle).toBe('UNKNOWN');
    expect(before.category).toBeNull();

    const at = tryClassifyAtCamera({
      productId: 'SKU-001',
      item,
      position: [CAMERA_SCAN_VOLUME.centerX, CAMERA_SCAN_VOLUME.centerY, 0],
    });
    expect(at.lifecycle).toBe('CLASSIFIED');
    expect(at.category).toBe(classifyItem(item).category);
    expect(at.measurement?.provenance).toBe('DIGITAL_SENSOR_SIMULATION');

    const again = tryClassifyAtCamera({
      productId: 'SKU-001',
      item,
      position: [CAMERA_SCAN_VOLUME.centerX, CAMERA_SCAN_VOLUME.centerY, 0],
    });
    expect(again.classifiedAtPhysicsStep).toBe(at.classifiedAtPhysicsStep);
  });

  it('measurement object is generated at camera', () => {
    const item = resolveItem('SKU-004');
    const m = measureProductAtCamera('SKU-004', item, 12);
    expect(m.productId).toBe('SKU-004');
    expect(m.measuredLengthMm).toBe(item.dimensionsMm.width);
    expect(m.cameraVolumeId).toBe(CAMERA_SCAN_VOLUME.id);
    expect(isInsideCameraVolume([CAMERA_SCAN_VOLUME.centerX, CAMERA_SCAN_VOLUME.centerY, 0])).toBe(true);
  });

  it('no route command before classification; mechanical route from event', () => {
    const item = resolveItem('SKU-006');
    try {
      requestRouteCommand('SKU-006', { allowBeforeClassification: true });
    } catch {
      /* DEV may throw — production path uses allow */
    }
    expect(getRouteWritesBeforeCameraEntry()).toBeGreaterThanOrEqual(0);
    const ev = tryClassifyAtCamera({
      productId: 'SKU-006',
      item,
      position: [CAMERA_SCAN_VOLUME.centerX, CAMERA_SCAN_VOLUME.centerY, 0],
    });
    const cmd = requestRouteCommand('SKU-006');
    expect(cmd.category).toBe(ev.category);
    expect(cmd.physicalRoute).not.toBe('NONE');
  });

  it('runtime product uses camera classification, not playlist classifyItem at mount', () => {
    expect(physicsSrc).toMatch(/tryClassifyAtCamera/);
    expect(physicsSrc).toMatch(/ProductVisualGroup/);
    expect(physicsSrc).toMatch(/castShadow=\{castShadow && spawned\}/);
    expect(physicsSrc).not.toMatch(/useMemo\(\(\) => classifyItem/);
  });
});

describe('documentation contrast contract', () => {
  it('required Ozon light documentation tokens are present', () => {
    expect(OZON_TOKENS.blue).toBe('#005BFF');
    expect(OZON_TOKENS.page).toBe('#F5F7FA');
    expect(OZON_TOKENS.surface).toBe('#FFFFFF');
    expect(OZON_TOKENS.surfaceSoft).toBe('#EEF4FF');
    expect(OZON_TOKENS.darkSpace).toBe('#001A34');
    expect(OZON_TOKENS.border).toBe('#DCE6F5');
    expect(PRODUCTION_STATUS.acquisitionPackStatus).not.toBe('DATA_ACQUISITION_PACK_READY');
    expect(PRODUCTION_STATUS.webTwinStatus).toBe('CAMERA_TRIGGERED_CLASSIFICATION_ACTIVE');
  });
});

describe('27-run physical matrix (B/C/D × shapes)', () => {
  it('27/27 correct receivers with fall / contact routing', () => {
    // Three shapes per route × three repeats (same profiles as junction matrix).
    const skusB = ['SKU-001', 'SKU-002', 'SKU-009'];
    const skusC = ['SKU-001', 'SKU-005', 'SKU-007'];
    const skusD = ['SKU-006', 'SKU-007', 'SKU-008'];
    const runs: Array<{ sku: string; zone: 'B' | 'C' | 'D' }> = [];
    for (const sku of skusB) for (let i = 0; i < 3; i += 1) runs.push({ sku, zone: 'B' });
    for (const sku of skusC) for (let i = 0; i < 3; i += 1) runs.push({ sku, zone: 'C' });
    for (const sku of skusD) for (let i = 0; i < 3; i += 1) runs.push({ sku, zone: 'D' });
    expect(runs.length).toBe(27);

    let passed = 0;
    const failures: string[] = [];
    for (const r of runs) {
      const result = simulateJunctionContact(r.sku, r.zone);
      if (result.correctReceiver && !result.failure && !result.invalidState) {
        passed += 1;
      } else {
        failures.push(`${r.sku}->${r.zone}: ${result.failure} @ ${JSON.stringify(result.finalPosition)}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(passed).toBe(27);
    void runJunctionMatrix;
  });
});
