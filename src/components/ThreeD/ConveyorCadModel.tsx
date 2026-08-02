/**
 * Stage 2 — CAD conveyor module (conveyor-clean.glb).
 *
 * Sorter: two existing gray CAD barriers as swing diverters.
 * Neutral parallel placement is baked once; motion = bind × axis-angle.
 *
 * Module frame before world group offset:
 *   +X = downstream (to baskets), +Y = up, +Z = physical LEFT.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Category } from '../../domain/types';
import { CONVEYOR_SPEED_MPS } from '../../domain/physicalLayout';
import {
  buildDiverterPlanes,
  createDiverterProductMachine,
  resetDiverterProductMachine,
  stepDiverterProductMachine,
  DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC,
  type DiverterProductMachineState,
  type DiverterPlaneSet,
} from '../../domain/pusherMotion';

const LOCAL_UP_AXIS = new THREE.Vector3(0, 1, 0);
const ACTIVE_ANGLE_RAD = THREE.MathUtils.degToRad(45);
/** Verified visual angular speed — do not change. */
const ANGULAR_SPEED_RAD = THREE.MathUtils.degToRad(
  DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC,
);

function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Explicit debug-only timer demo — OFF unless ?diverterMotionDemo=1. */
function motionDemoEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('diverterMotionDemo') === '1';
}

function demoModeAt(tSec: number): 'NEUTRAL' | 'LEFT_ACTIVE' | 'RIGHT_ACTIVE' {
  if (tSec < 2.0) return 'NEUTRAL';
  if (tSec < 4.0) return 'LEFT_ACTIVE';
  if (tSec < 5.5) return 'NEUTRAL';
  if (tSec < 7.5) return 'RIGHT_ACTIVE';
  return 'NEUTRAL';
}

/**
 * Pick ±45° so free-end crosses toward the opposite belt edge
 * (LEFT +Z → toward −Z; RIGHT −Z → toward +Z).
 */
function selectSignedActiveAngle(
  side: 'left' | 'right',
  hinge: THREE.Vector3,
  freeAt0: THREE.Vector3,
): number {
  const rotateFree = (angle: number) => {
    const rel = freeAt0.clone().sub(hinge);
    rel.applyAxisAngle(LOCAL_UP_AXIS, angle);
    return hinge.clone().add(rel);
  };
  const freePlus = rotateFree(+ACTIVE_ANGLE_RAD);
  const freeMinus = rotateFree(-ACTIVE_ANGLE_RAD);
  // Prefer the candidate that moves free-end toward opposite lateral sign
  // and keeps |z| within the module (~belt half-width + margin).
  const score = (p: THREE.Vector3) => {
    const towardOpposite = side === 'left' ? -p.z : +p.z; // higher = more toward opposite
    const inModule = Math.abs(p.z) <= BELT_HALF_WIDTH_M + 0.08 ? 1 : -2;
    const crosses = (side === 'left' ? p.z < 0 : p.z > 0) ? 1 : 0;
    return towardOpposite + inModule * 10 + crosses * 5;
  };
  const selected = score(freePlus) >= score(freeMinus)
    ? +ACTIVE_ANGLE_RAD
    : -ACTIVE_ANGLE_RAD;

  return selected;
}

export const CONVEYOR_CAD_URL = '/models/sorter/conveyor-clean.glb';

export const CAD_MODULE_LENGTH_M = 2.01;
export const CAD_MODULE_Y = 0.594;

export const CAD_MODULE_ORIGINS = {
  clean: -4.02,
  camera: -2.01,
  sorter: 0.0,
} as const;

export type CadModuleVariant = keyof typeof CAD_MODULE_ORIGINS;

export const CONVEYOR_CAD_POSITION: [number, number, number] = [
  CAD_MODULE_ORIGINS.camera, CAD_MODULE_Y, 0,
];
export const CONVEYOR_CAD_SPAN_X: [number, number] = [
  CAD_MODULE_ORIGINS.clean,
  CAD_MODULE_ORIGINS.sorter + CAD_MODULE_LENGTH_M,
];

export const CAD_SORTER_GATE_LEFT = 'stop-gate/Барьер001';
export const CAD_SORTER_GATE_RIGHT = 'stop-gate/Барьер002';

const UP = new THREE.Vector3(0, 1, 0);
/** Sorter entry / exit centers in module-local space (ox=0). */
const SORTER_ENTRY_CENTER = new THREE.Vector3(0.15, 0.168, 0);
const SORTER_EXIT_CENTER = new THREE.Vector3(1.95, 0.168, 0);
const BELT_HALF_WIDTH_M = 0.25;
const DOWNSTREAM_HINGE_X = 1.55;
const HINGE_Y = 0.168;
const PARALLEL_DOT_MIN = 0.99996; // ≤ ~0.5°

export const CAD_SORTER_WORLD_PIVOTS: {
  left: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
} = {
  left: {
    x: CAD_MODULE_ORIGINS.sorter + DOWNSTREAM_HINGE_X,
    y: CAD_MODULE_Y + HINGE_Y,
    z: +(BELT_HALF_WIDTH_M - 0.02),
  },
  right: {
    x: CAD_MODULE_ORIGINS.sorter + DOWNSTREAM_HINGE_X,
    y: CAD_MODULE_Y + HINGE_Y,
    z: -(BELT_HALF_WIDTH_M - 0.02),
  },
};

export const CAD_DIVERTER_HALF_LENGTH_M = 0.375;

const MATERIALS: Record<string, THREE.MeshStandardMaterial> = {};
function materialFor(slot: string): THREE.MeshStandardMaterial {
  if (!MATERIALS[slot]) {
    const defs: Record<string, { color: string; metalness: number; roughness: number }> = {
      'painted-metal': { color: '#8b9cae', metalness: 0.55, roughness: 0.45 },
      'brushed-metal': { color: '#b9c2cc', metalness: 0.9, roughness: 0.3 },
      'rubber-belt': { color: '#39424a', metalness: 0.0, roughness: 0.92 },
      'dark-mechanical': { color: '#3a4148', metalness: 0.6, roughness: 0.5 },
      // Presentation override for author servo mounts (readable, not crushed black).
      'servo-cad': { color: '#525c66', metalness: 0.55, roughness: 0.48 },
      'sorter-guide': { color: '#9aa3ad', metalness: 0.45, roughness: 0.5 },
    };
    const def = defs[slot] ?? defs['painted-metal'];
    MATERIALS[slot] = new THREE.MeshStandardMaterial({
      ...def,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    });
  }
  return MATERIALS[slot];
}

/** World-space stripe pitch along belt travel (m). */
const BELT_STRIPE_PITCH_M = 0.14;
/** Shared phase advanced once per frame from the clean module only. */
const beltPhase = { u: 0 };
let beltStripeTexTop: THREE.CanvasTexture | null = null;
let beltStripeTexBottom: THREE.CanvasTexture | null = null;
let beltMatTop: THREE.MeshStandardMaterial | null = null;
let beltMatBottom: THREE.MeshStandardMaterial | null = null;

function createBeltStripeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#39424a';
  ctx.fillRect(0, 0, 128, 32);
  // Thin low-contrast transverse marks (industrial, not road stripes).
  ctx.fillStyle = '#323940';
  for (let x = 0; x < 128; x += 16) {
    ctx.fillRect(x, 0, 2, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function ensureBeltMaterials(): {
  top: THREE.MeshStandardMaterial;
  bottom: THREE.MeshStandardMaterial;
} {
  if (!beltMatTop) {
    const tex = createBeltStripeTexture();
    beltStripeTexTop = tex;
    beltStripeTexBottom = tex ? tex.clone() : null;
    if (beltStripeTexBottom) {
      beltStripeTexBottom.wrapS = THREE.RepeatWrapping;
      beltStripeTexBottom.wrapT = THREE.RepeatWrapping;
    }
    beltMatTop = new THREE.MeshStandardMaterial({
      color: '#3d4650',
      map: beltStripeTexTop ?? undefined,
      metalness: 0.02,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    beltMatBottom = new THREE.MeshStandardMaterial({
      color: '#353c44',
      map: beltStripeTexBottom ?? undefined,
      metalness: 0.02,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
  }
  return { top: beltMatTop!, bottom: beltMatBottom! };
}

function stepBeltTexturePhase(
  dt: number,
  beltSpeedMps: number,
  paused: boolean,
  isWriter: boolean,
): number {
  if (isWriter && !paused && beltSpeedMps > 0) {
    beltPhase.u = (beltPhase.u + (beltSpeedMps * dt) / BELT_STRIPE_PITCH_M) % 1;
  }
  if (beltStripeTexTop && beltStripeTexBottom) {
    // UVs already in world-pitch units; keep repeat=1 and scroll offset.
    beltStripeTexTop.repeat.set(1, 1);
    beltStripeTexBottom.repeat.set(1, 1);
    // Top branch downstream (+X); bottom return opposite.
    beltStripeTexTop.offset.x = -beltPhase.u;
    beltStripeTexBottom.offset.x = beltPhase.u;
  }
  return beltPhase.u;
}

/** Project travel-aligned UVs onto belt geometry (CAD export often lacks usable UVs). */
function applyBeltTravelUVs(mesh: THREE.Mesh): void {
  const geom = mesh.geometry;
  if (!geom.getAttribute('position')) return;
  const pos = geom.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  // Prefer local X as travel; fall back to longest horizontal axis.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv[i * 2] = x / BELT_STRIPE_PITCH_M;
    uv[i * 2 + 1] = (z + 0.25) / 0.5;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geom.attributes.uv.needsUpdate = true;
}

function addBeltReturnSurface(scene: THREE.Object3D, topBelt: THREE.Mesh): THREE.Mesh {
  const { bottom } = ensureBeltMaterials();
  // CAD top belt: center ~(0.939, 0.109, 0), size ~(1.972, 0.002, 0.5).
  // Return branch under rollers (roller center y≈0.08, r≈0.025 → y≈0.055).
  const geo = new THREE.PlaneGeometry(1.92, 0.48);
  // PlaneGeometry UVs: map U along X after rotation.
  const mesh = new THREE.Mesh(geo, bottom);
  mesh.name = 'runtime-belt-return';
  mesh.rotation.x = Math.PI / 2; // face down-ish; DoubleSide
  mesh.position.set(0.939, 0.055, 0);
  mesh.receiveShadow = topBelt.receiveShadow;
  // Travel U along plane local X (= world X after rotation).
  const uv = mesh.geometry.getAttribute('uv');
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      // PlaneGeometry default: u across width, v across length → swap for travel stripes.
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, v * (1.92 / BELT_STRIPE_PITCH_M), u);
    }
    uv.needsUpdate = true;
  }
  scene.add(mesh);
  return mesh;
}

function publishCameraPortalMount(scene: THREE.Object3D, originX: number): void {
  if (typeof window === 'undefined') return;
  let portal: THREE.Mesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && /inspection-frame|Крепление_камер/.test(m.name)) portal = m;
  });
  const entries: Array<Record<string, unknown>> = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!/inspection-frame|Крепление_камер|camera|камер/i.test(m.name)) return;
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    entries.push({
      NODE: m.name,
      PARENT: m.parent?.name ?? '(root)',
      SOURCE: 'conveyor-clean.glb',
      AUTHOR_CAD_OR_RUNTIME: 'AUTHOR_CAD',
      VISIBLE: m.visible,
      WORLD_POSITION: [
        +(originX + c.x).toFixed(3),
        +(CAD_MODULE_Y + c.y).toFixed(3),
        +c.z.toFixed(3),
      ],
      FUNCTION: 'CAD portal / camera mount',
      KEEP_OR_HIDE: 'KEEP',
    });
  });
  // Mount point: underside of portal cross-beam (local AABB top − small bind).
  let mount = {
    x: originX + 0.52,
    y: CAD_MODULE_Y + 0.52,
    z: 0,
  };
  if (portal) {
    const box = new THREE.Box3().setFromObject(portal);
    mount = {
      x: originX + (box.min.x + box.max.x) / 2,
      y: CAD_MODULE_Y + box.max.y - 0.012,
      z: (box.min.z + box.max.z) / 2,
    };
  }
  const w = window as unknown as {
    __CAMERA_PORTAL_MOUNT?: typeof mount;
    __CAMERA_NODE_AUDIT?: unknown;
  };
  w.__CAMERA_PORTAL_MOUNT = mount;
  w.__CAMERA_NODE_AUDIT = entries;
}

function nodePathName(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.name) parts.push(cur.name);
    cur = cur.parent;
  }
  return parts.join('|');
}

function slotFor(nodeName: string): string {
  if (/Барьер001|Барьер002/.test(nodeName)) return 'sorter-guide';
  if (/conveyor-belt/.test(nodeName)) return 'rubber-belt';
  if (/rollers/.test(nodeName)) return 'brushed-metal';
  if (/motor-and-drive/.test(nodeName)) return 'dark-mechanical';
  if (/pusher-servo/.test(nodeName)) return 'servo-cad';
  if (/inspection-frame/.test(nodeName)) return 'painted-metal';
  if (/static-frame/.test(nodeName)) return 'painted-metal';
  if (/stop-gate/.test(nodeName)) return 'sorter-guide';
  return 'painted-metal';
}

function repivot(mesh: THREE.Mesh): THREE.Group {
  const parent = mesh.parent;
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.name = `pivot/${mesh.name}`;
  pivot.position.copy(center);
  mesh.position.sub(center);
  pivot.add(mesh);
  parent?.add(pivot);
  return pivot;
}

function shouldKeepMesh(name: string, variant: CadModuleVariant): boolean {
  // Author CAD sorter drive (servo body / holders) — sorter module only.
  if (/pusher-servo/.test(name)) return variant === 'sorter';
  if (/stop-gate|Барьер/.test(name)) return variant === 'sorter';
  if (/inspection-frame/.test(name)) return variant === 'camera';
  if (/motor-and-drive/.test(name)) return variant === 'clean';
  return true;
}

/** Author CAD sorter-drive node → role. No horn/DS51 in exported GLB. */
function authorCadServoRole(name: string): {
  function: string;
  motionClass: 'FIXED' | 'MOVING';
} {
  if (/Серво_привод001/.test(name)) {
    return { function: 'LEFT servo body (author CAD)', motionClass: 'FIXED' };
  }
  if (/Серво_привод/.test(name)) {
    return { function: 'RIGHT servo body (author CAD)', motionClass: 'FIXED' };
  }
  if (/Держатель-сервопривода/.test(name)) {
    return { function: 'RIGHT servo holder (author CAD)', motionClass: 'FIXED' };
  }
  if (/Держатель_серво/.test(name)) {
    return { function: 'RIGHT servo mount plate (author CAD)', motionClass: 'FIXED' };
  }
  if (/серво001/.test(name)) {
    return { function: 'LEFT servo holder (author CAD)', motionClass: 'FIXED' };
  }
  return { function: 'author CAD sorter drive part', motionClass: 'FIXED' };
}

function publishAuthorCadDetails(
  scene: THREE.Object3D,
  variant: CadModuleVariant,
): void {
  if (typeof window === 'undefined' || variant !== 'sorter') return;
  type Detail = {
    node: string;
    parent: string;
    authorCadOrDerived: 'AUTHOR_CAD';
    visible: boolean;
    worldAabbCenter: number[];
    worldAabbSize: number[];
    function: string;
    motionClass: 'FIXED' | 'MOVING';
    restoreOrKeepHidden: 'RESTORE';
  };
  const details: Detail[] = [];
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !/pusher-servo/.test(mesh.name)) return;
    box.setFromObject(mesh);
    box.getCenter(center);
    box.getSize(size);
    const role = authorCadServoRole(mesh.name);
    details.push({
      node: mesh.name,
      parent: mesh.parent?.name ?? '(root)',
      authorCadOrDerived: 'AUTHOR_CAD',
      visible: mesh.visible,
      worldAabbCenter: center.toArray().map((v) => +v.toFixed(4)),
      worldAabbSize: size.toArray().map((v) => +v.toFixed(4)),
      function: role.function,
      motionClass: role.motionClass,
      restoreOrKeepHidden: 'RESTORE',
    });
  });
  const w = window as unknown as {
    __AUTHOR_CAD_DETAILS?: unknown;
    __AUTHOR_CAD_INCOMPLETE?: string[];
    __GENERATED_SORTER_INSTANCES?: number;
  };
  w.__AUTHOR_CAD_DETAILS = {
    count: details.length,
    expectedInstancesEach: 1,
    hornPresent: false,
    incomplete: ['DS51_18T_horn / Part__Feature horn — not present in conveyor-clean.glb'],
    details,
  };
  w.__AUTHOR_CAD_INCOMPLETE = [
    'horn/DS51 — AUTHOR_CAD_INCOMPLETE (not in exported GLB)',
  ];
  w.__GENERATED_SORTER_INSTANCES = 0;
}

/**
 * True geometric long-axis of the CAD mesh in local geometry space.
 * Uses farthest vertex pair (not AABB face centers) so a diagonally
 * authored bar is measured along its real length, then reported against
 * the local AABB's longest dimension name for logging.
 */
function localLongAxisEndpoints(geometry: THREE.BufferGeometry): {
  e0: THREE.Vector3;
  e1: THREE.Vector3;
  longAxis: 0 | 1 | 2;
  size: THREE.Vector3;
  thicknessM: number;
} {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox ?? new THREE.Box3();
  const size = bb.getSize(new THREE.Vector3());
  let longAxis: 0 | 1 | 2 = 0;
  if (size.y >= size.x && size.y >= size.z) longAxis = 1;
  else if (size.z >= size.x && size.z >= size.y) longAxis = 2;

  const pos = geometry.getAttribute('position');
  const e0 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  if (pos && pos.count >= 2) {
    const step = Math.max(1, Math.floor(pos.count / 900));
    const pts: THREE.Vector3[] = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += step) {
      pts.push(tmp.fromBufferAttribute(pos, i).clone());
    }
    let maxD = -1;
    let ia = 0;
    let ib = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = pts[i].distanceToSquared(pts[j]);
        if (d > maxD) {
          maxD = d;
          ia = i;
          ib = j;
        }
      }
    }
    e0.copy(pts[ia]);
    e1.copy(pts[ib]);
  } else {
    const mid = bb.getCenter(new THREE.Vector3());
    e0.copy(mid);
    e1.copy(mid);
    e0.setComponent(longAxis, bb.min.getComponent(longAxis));
    e1.setComponent(longAxis, bb.max.getComponent(longAxis));
  }

  // True thickness = extent orthogonal to the geometric long axis (XZ plan).
  const longDir = e1.clone().sub(e0).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const lat = new THREE.Vector3().crossVectors(up, longDir);
  if (lat.lengthSq() < 1e-8) lat.set(0, 0, 1);
  else lat.normalize();
  let minL = Infinity;
  let maxL = -Infinity;
  const tmp = new THREE.Vector3();
  const posAttr = geometry.getAttribute('position');
  if (posAttr) {
    const step = Math.max(1, Math.floor(posAttr.count / 900));
    for (let i = 0; i < posAttr.count; i += step) {
      tmp.fromBufferAttribute(posAttr, i);
      const l = tmp.dot(lat);
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
    }
  }
  const thicknessM = Number.isFinite(minL) ? Math.max(0.01, maxL - minL) : 0.025;
  return { e0, e1, longAxis, size, thicknessM };
}

function makeDebugSphere(color: number, radius = 0.03): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 12),
    new THREE.MeshBasicMaterial({ color, depthTest: true }),
  );
}

function makeDebugLine(a: THREE.Vector3, b: THREE.Vector3, color: number): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
}

export type ParallelProofMetrics = {
  node: string;
  longestLocalAxis: 'X' | 'Y' | 'Z';
  partLongAxis: [number, number, number];
  downstreamAxis: [number, number, number];
  dot: number;
  angleDeg: number;
  centerLateral: number;
  hingeDownstream: number;
  freeDownstream: number;
  parallel: boolean;
};

/**
 * Mount one CAD barrier as a frozen neutral side rail.
 * Geometry is baked into module space first (diagonal is vertex-authored),
 * then PART_LONG_AXIS is aligned onto DOWNSTREAM via setFromUnitVectors
 * about the downstream hinge, and parked on the belt edge.
 */
function mountParallelNeutralDiverter(
  mesh: THREE.Mesh,
  side: 'left' | 'right',
  sceneRoot: THREE.Object3D,
  downstream: THREE.Vector3,
  nodeLabel: string,
): {
  pivot: THREE.Group;
  hingeScene: THREE.Vector3;
  freeScene: THREE.Vector3;
  metrics: ParallelProofMetrics;
  thicknessM: number;
} {
  sceneRoot.updateMatrixWorld(true);
  mesh.updateWorldMatrix(true, false);

  // Bake current world transform into geometry so the authored diagonal
  // lives in module-local vertex space (parent hierarchy cannot fight us).
  const baked = mesh.geometry.clone();
  baked.applyMatrix4(mesh.matrixWorld);
  baked.computeBoundingBox();
  baked.computeBoundingSphere();
  mesh.geometry = baked;
  mesh.parent?.remove(mesh);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
  sceneRoot.add(mesh);
  mesh.updateMatrixWorld(true);

  const { e0, e1, longAxis, thicknessM } = localLongAxisEndpoints(mesh.geometry);
  // After bake, local ≡ module world.
  const w0 = e0.clone();
  const w1 = e1.clone();

  const hingeW = w0.dot(downstream) >= w1.dot(downstream) ? w0.clone() : w1.clone();
  const freeW = w0.dot(downstream) >= w1.dot(downstream) ? w1.clone() : w0.clone();
  const partLong = hingeW.clone().sub(freeW).normalize();

  // Rotate geometry about hinge so free→hinge maps onto downstream.
  const qAlign = new THREE.Quaternion().setFromUnitVectors(partLong, downstream);
  const toHinge = new THREE.Matrix4().makeTranslation(-hingeW.x, -hingeW.y, -hingeW.z);
  const rot = new THREE.Matrix4().makeRotationFromQuaternion(qAlign);
  const fromHinge = new THREE.Matrix4().makeTranslation(hingeW.x, hingeW.y, hingeW.z);
  const alignMat = new THREE.Matrix4().multiplyMatrices(fromHinge, rot).multiply(toHinge);
  mesh.geometry = mesh.geometry.clone();
  mesh.geometry.applyMatrix4(alignMat);
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();

  // Park: translate geometry so hinge lands on the belt-edge park point.
  const inset = Math.max(0.008, Math.min(0.04, thicknessM / 2));
  const lateral = side === 'left'
    ? +(BELT_HALF_WIDTH_M - inset)
    : -(BELT_HALF_WIDTH_M - inset);
  const parkHinge = new THREE.Vector3(DOWNSTREAM_HINGE_X, HINGE_Y, lateral);
  const delta = parkHinge.clone().sub(hingeW);
  mesh.geometry.translate(delta.x, delta.y, delta.z);
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();

  // Pivot at park hinge; geometry already in module space — attach preserves world.
  const pivot = new THREE.Group();
  pivot.name = `diverter-pivot/${side}`;
  pivot.position.copy(parkHinge);
  pivot.quaternion.identity();
  sceneRoot.add(pivot);
  pivot.attach(mesh);
  mesh.updateMatrixWorld(true);

  // Neutral bind fixed once (geometry already parallel). Do not recompute later.
  const bind = new THREE.Quaternion(); // identity
  pivot.userData.side = side;
  pivot.userData.neutralBindQuaternion = bind.clone();
  pivot.userData.nodeLabel = nodeLabel;

  const live2 = measureLiveLongAxis(mesh, downstream);
  const hingeScene = live2.hinge.clone();
  const freeScene = live2.free.clone();

  // Pivot-local free-end offset (for arc marker updates during motion).
  pivot.updateMatrixWorld(true);
  const freeLocal = pivot.worldToLocal(freeScene.clone());
  pivot.userData.freeLocal = freeLocal;
  pivot.userData.hingeRestModule = hingeScene.clone();
  pivot.userData.signedActiveAngleRad = selectSignedActiveAngle(side, hingeScene, freeScene);

  const axisName = (['X', 'Y', 'Z'] as const)[longAxis];
  const dot = live2.partLong.dot(downstream);
  const angleDeg = (Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI;
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  const boxSize = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());

  const metrics: ParallelProofMetrics = {
    node: nodeLabel,
    longestLocalAxis: axisName,
    partLongAxis: live2.partLong.toArray().map((v) => +v.toFixed(6)) as [number, number, number],
    downstreamAxis: downstream.toArray().map((v) => +v.toFixed(6)) as [number, number, number],
    dot: +dot.toFixed(6),
    angleDeg: +angleDeg.toFixed(4),
    centerLateral: +center.z.toFixed(4),
    hingeDownstream: +live2.hinge.dot(downstream).toFixed(4),
    freeDownstream: +live2.free.dot(downstream).toFixed(4),
    parallel:
      Math.abs(dot) >= PARALLEL_DOT_MIN
      && angleDeg <= 0.5
      && boxSize.x > boxSize.z * 3,
  };

  return { pivot, hingeScene, freeScene, metrics, thicknessM };
}

/** Live world long-axis of a mounted CAD mesh (farthest verts → world). */
function measureLiveLongAxis(
  mesh: THREE.Mesh,
  downstream: THREE.Vector3,
): { partLong: THREE.Vector3; hinge: THREE.Vector3; free: THREE.Vector3 } {
  mesh.updateWorldMatrix(true, false);
  const { e0, e1 } = localLongAxisEndpoints(mesh.geometry);
  const w0 = e0.clone().applyMatrix4(mesh.matrixWorld);
  const w1 = e1.clone().applyMatrix4(mesh.matrixWorld);
  const hinge = w0.dot(downstream) >= w1.dot(downstream) ? w0 : w1;
  const free = w0.dot(downstream) >= w1.dot(downstream) ? w1 : w0;
  const partLong = hinge.clone().sub(free).normalize();
  return { partLong, hinge, free };
}

function makeDebugLabel(text: string, color: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), mat);
  mesh.renderOrder = 10;
  return mesh;
}

type DiverterDebugHandles = {
  leftHinge: THREE.Mesh;
  leftFree: THREE.Mesh;
  rightHinge: THREE.Mesh;
  rightFree: THREE.Mesh;
  leftAxis: THREE.Line;
  rightAxis: THREE.Line;
};

function setLineEndpoints(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
  const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function addParallelProofDebug(
  sceneRoot: THREE.Object3D,
  downstream: THREE.Vector3,
  left: { hingeScene: THREE.Vector3; freeScene: THREE.Vector3 },
  right: { hingeScene: THREE.Vector3; freeScene: THREE.Vector3 },
): DiverterDebugHandles {
  const g = new THREE.Group();
  g.name = 'diverter-parallel-debug';
  const y = HINGE_Y + 0.04;

  // White DOWNSTREAM centerline
  const dsA = new THREE.Vector3(0.4, y, 0);
  const dsB = dsA.clone().addScaledVector(downstream, 1.6);
  g.add(makeDebugLine(dsA, dsB, 0xffffff));

  const lFree = left.freeScene.clone(); lFree.y = y;
  const lHing = left.hingeScene.clone(); lHing.y = y;
  const rFree = right.freeScene.clone(); rFree.y = y;
  const rHing = right.hingeScene.clone(); rHing.y = y;
  const leftAxis = makeDebugLine(lFree, lHing, 0xff2222);
  const rightAxis = makeDebugLine(rFree, rHing, 0x2288ff);
  leftAxis.name = 'diverter-debug-left-axis';
  rightAxis.name = 'diverter-debug-right-axis';
  g.add(leftAxis, rightAxis);

  const leftHinge = makeDebugSphere(0xff2222);
  leftHinge.name = 'diverter-debug-left-hinge';
  leftHinge.position.copy(left.hingeScene); leftHinge.position.y = y;
  const leftFree = makeDebugSphere(0x2288ff);
  leftFree.name = 'diverter-debug-left-free';
  leftFree.position.copy(left.freeScene); leftFree.position.y = y;
  const rightHinge = makeDebugSphere(0xff2222);
  rightHinge.name = 'diverter-debug-right-hinge';
  rightHinge.position.copy(right.hingeScene); rightHinge.position.y = y;
  const rightFree = makeDebugSphere(0x2288ff);
  rightFree.name = 'diverter-debug-right-free';
  rightFree.position.copy(right.freeScene); rightFree.position.y = y;
  g.add(leftHinge, leftFree, rightHinge, rightFree);

  if (typeof document !== 'undefined') {
    const leftLbl = makeDebugLabel('LEFT', '#ff4444');
    leftLbl.position.set(
      (left.hingeScene.x + left.freeScene.x) / 2,
      y + 0.08,
      left.hingeScene.z + 0.08,
    );
    leftLbl.rotation.x = -Math.PI / 2;
    const rightLbl = makeDebugLabel('RIGHT', '#4488ff');
    rightLbl.position.set(
      (right.hingeScene.x + right.freeScene.x) / 2,
      y + 0.08,
      right.hingeScene.z - 0.08,
    );
    rightLbl.rotation.x = -Math.PI / 2;
    g.add(leftLbl, rightLbl);
  }

  sceneRoot.add(g);
  return { leftHinge, leftFree, rightHinge, rightFree, leftAxis, rightAxis };
}

function publishParallelProof(
  downstream: THREE.Vector3,
  lateral: THREE.Vector3,
  left: ParallelProofMetrics,
  right: ParallelProofMetrics,
  leftBox: THREE.Box3,
  rightBox: THREE.Box3,
) {
  const leftCross = leftBox.min.z < 0 && leftBox.max.z > 0;
  const rightCross = rightBox.min.z < 0 && rightBox.max.z > 0;
  const corridor = leftBox.min.z - rightBox.max.z;
  const opposite = left.centerLateral * right.centerLateral < 0;
  const pass =
    left.parallel
    && right.parallel
    && opposite
    && !leftCross
    && !rightCross
    && corridor > 0
    && left.hingeDownstream > left.freeDownstream
    && right.hingeDownstream > right.freeDownstream
    && Math.abs(left.centerLateral) > 0.05
    && Math.abs(right.centerLateral) > 0.05;


  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      __DIVERTER_PARALLEL?: unknown;
      leftNeutralBindQuaternion?: THREE.Quaternion;
      rightNeutralBindQuaternion?: THREE.Quaternion;
    };
    w.__DIVERTER_PARALLEL = {
      pass,
      downstream: downstream.toArray(),
      lateral: lateral.toArray(),
      left,
      right,
      centralCorridorOpen: corridor > 0 && !leftCross && !rightCross,
      leftBoxSize: leftBox.getSize(new THREE.Vector3()).toArray(),
      rightBoxSize: rightBox.getSize(new THREE.Vector3()).toArray(),
    };
    // Sole neutral binds for this pass (identity — alignment baked into geometry).
    w.leftNeutralBindQuaternion = new THREE.Quaternion();
    w.rightNeutralBindQuaternion = new THREE.Quaternion();
  }
  return pass;
}

export function ConveyorCadModule({
  variant,
  originX,
  shadows = false,
  rollerOmegaRadPerSec = 0,
  beltVelocityMps = 0,
  sorterCategory = null,
  caseElapsedMs: _caseElapsedMs = 0,
  productId = null,
  itemWorldX = null,
  itemHalfLengthS = 0.15,
  playbackPaused = false,
  playbackResetEpoch = 0,
}: {
  variant: CadModuleVariant;
  originX: number;
  shadows?: boolean;
  rollerOmegaRadPerSec?: number;
  beltVelocityMps?: number;
  sorterCategory?: Category | null;
  caseElapsedMs?: number;
  productId?: string | null;
  itemWorldX?: number | null;
  itemHalfLengthS?: number;
  playbackPaused?: boolean;
  playbackResetEpoch?: number;
}) {
  void _caseElapsedMs;

  const gltf = useLoader(GLTFLoader, CONVEYOR_CAD_URL, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  });
  const { invalidate } = useThree();

  const rollerPivots = useRef<THREE.Group[]>([]);
  const sorterPivots = useRef<{ left: THREE.Group | null; right: THREE.Group | null }>({
    left: null,
    right: null,
  });
  const rollerAngle = useRef(0);
  const rollerRadiusM = useRef(0.025); // CAD Ролик diameter 50mm — PRESENTATION_DERIVED
  const debugHandles = useRef<DiverterDebugHandles | null>(null);
  const productMachine = useRef<DiverterProductMachineState>(createDiverterProductMachine());
  const planesRef = useRef<DiverterPlaneSet | null>(null);
  const lastResetEpoch = useRef(playbackResetEpoch);
  const motion = useRef({
    leftCurrent: 0,
    leftTarget: 0,
    rightCurrent: 0,
    rightTarget: 0,
    leftSigned: -ACTIVE_ANGLE_RAD,
    rightSigned: +ACTIVE_ANGLE_RAD,
    demoT0Ms: 0,
    demoArmed: false,
    leftHingeWorld0: null as THREE.Vector3 | null,
    rightHingeWorld0: null as THREE.Vector3 | null,
    maxLeftHingeDriftMm: 0,
    maxRightHingeDriftMm: 0,
  });
  const scratch = useRef({
    qMotion: new THREE.Quaternion(),
    qFinal: new THREE.Quaternion(),
    hinge: new THREE.Vector3(),
    free: new THREE.Vector3(),
    freeLocal: new THREE.Vector3(),
    up: LOCAL_UP_AXIS.clone(),
  });

  const root = useMemo(() => {
    rollerPivots.current = [];
    sorterPivots.current = { left: null, right: null };
    debugHandles.current = null;
    motion.current.demoArmed = false;
    motion.current.demoT0Ms = 0;
    resetDiverterProductMachine(productMachine.current);
    planesRef.current = null;

    const scene = gltf.scene.clone(true);
    const toRoller: THREE.Mesh[] = [];
    let leftMesh: THREE.Mesh | null = null;
    let rightMesh: THREE.Mesh | null = null;
    let topBelt: THREE.Mesh | null = null;
    const hideList: THREE.Object3D[] = [];
    const { top: beltTopMat } = ensureBeltMaterials();

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = nodePathName(mesh);
      if (/conveyor-belt|Лента/.test(name)) {
        applyBeltTravelUVs(mesh);
        mesh.material = beltTopMat;
        topBelt = mesh;
      } else {
        mesh.material = materialFor(slotFor(name));
      }
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mesh.castShadow = shadows && (
        /static-frame|conveyor-belt|inspection-frame|motor-and-drive|Барьер|pusher-servo/.test(name)
      );
      mesh.receiveShadow = shadows;

      if (!shouldKeepMesh(name, variant)) {
        hideList.push(mesh);
        return;
      }
      if (/Барьер001/.test(name)) leftMesh = mesh;
      else if (/Барьер002/.test(name)) rightMesh = mesh;
      else if (/rollersРолик\d*$/.test(mesh.name) || /rollers\/?Ролик\d*$/.test(name)) {
        // End drums only — not shaft (Вал) or mid assemblies.
        toRoller.push(mesh);
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        rollerRadiusM.current = Math.min(size.x, size.y) / 2;
      }
    });

    for (const m of hideList) {
      m.visible = false;
      m.parent?.remove(m);
    }
    for (const m of toRoller) rollerPivots.current.push(repivot(m));
    if (topBelt) addBeltReturnSurface(scene, topBelt);

    scene.updateMatrixWorld(true);

    if (variant === 'camera') {
      publishCameraPortalMount(scene, originX);
    }

    if (variant === 'sorter') {
      const downstream = SORTER_EXIT_CENTER.clone().sub(SORTER_ENTRY_CENTER).normalize();
      const lateral = new THREE.Vector3().crossVectors(UP, downstream).normalize();
      // Sanity: orthogonal
      if (Math.abs(downstream.dot(lateral)) > 0.001) {
        // eslint-disable-next-line no-console
        console.warn('[DIVERTER_PARALLEL] non-orthogonal frame', downstream.dot(lateral));
      }

      let leftResult: ReturnType<typeof mountParallelNeutralDiverter> | null = null;
      let rightResult: ReturnType<typeof mountParallelNeutralDiverter> | null = null;

      if (leftMesh) {
        leftResult = mountParallelNeutralDiverter(
          leftMesh, 'left', scene, downstream, CAD_SORTER_GATE_LEFT,
        );
        sorterPivots.current.left = leftResult.pivot;
      }
      if (rightMesh) {
        rightResult = mountParallelNeutralDiverter(
          rightMesh, 'right', scene, downstream, CAD_SORTER_GATE_RIGHT,
        );
        sorterPivots.current.right = rightResult.pivot;
      }

      if (leftResult && rightResult) {
        const showDbg = typeof window === 'undefined'
          || new URLSearchParams(window.location.search).get('diverterParallel') !== '0';
        if (showDbg) {
          debugHandles.current = addParallelProofDebug(
            scene, downstream, leftResult, rightResult,
          );
        }

        motion.current.leftSigned = leftResult.pivot.userData.signedActiveAngleRad as number;
        motion.current.rightSigned = rightResult.pivot.userData.signedActiveAngleRad as number;

        const lenM = leftResult.hingeScene.distanceTo(leftResult.freeScene);
        const hingeS = CAD_MODULE_ORIGINS.sorter + leftResult.hingeScene.x;
        planesRef.current = buildDiverterPlanes(hingeS, lenM);

        const leftBox = new THREE.Box3().setFromObject(leftMesh!);
        const rightBox = new THREE.Box3().setFromObject(rightMesh!);
        publishParallelProof(
          downstream,
          lateral,
          leftResult.metrics,
          rightResult.metrics,
          leftBox,
          rightBox,
        );

        CAD_SORTER_WORLD_PIVOTS.left.x = CAD_MODULE_ORIGINS.sorter + leftResult.hingeScene.x;
        CAD_SORTER_WORLD_PIVOTS.left.y = CAD_MODULE_Y + leftResult.hingeScene.y;
        CAD_SORTER_WORLD_PIVOTS.left.z = leftResult.hingeScene.z;
        CAD_SORTER_WORLD_PIVOTS.right.x = CAD_MODULE_ORIGINS.sorter + rightResult.hingeScene.x;
        CAD_SORTER_WORLD_PIVOTS.right.y = CAD_MODULE_Y + rightResult.hingeScene.y;
        CAD_SORTER_WORLD_PIVOTS.right.z = rightResult.hingeScene.z;

        // Authoritative handles on the scene object itself (survives Strict Mode ref resets).
        scene.userData.diverterPivots = {
          left: leftResult.pivot,
          right: rightResult.pivot,
        };
        scene.userData.diverterDebug = debugHandles.current;
        leftResult.pivot.matrixAutoUpdate = true;
        rightResult.pivot.matrixAutoUpdate = true;
      }

      if (typeof window !== 'undefined') {
        const w = window as unknown as {
          __GATE_MOUNTED?: { left: boolean; right: boolean };
          __GATE_ANGLES?: { left: number; right: number };
          __GATE_STATE?: unknown;
          __DIVERTER_MOTIONS?: { leftRad: number; rightRad: number };
          leftNeutralBindQuaternion?: THREE.Quaternion;
          rightNeutralBindQuaternion?: THREE.Quaternion;
        };
        w.__GATE_MOUNTED = {
          left: !!sorterPivots.current.left,
          right: !!sorterPivots.current.right,
        };
        w.__GATE_ANGLES = { left: 0, right: 0 };
        w.__GATE_STATE = {
          motionMode: 'NEUTRAL',
          phase: 'READY',
          leftTargetRad: 0,
          rightTargetRad: 0,
        };
        w.__DIVERTER_MOTIONS = { leftRad: 0, rightRad: 0 };
        w.leftNeutralBindQuaternion = (
          sorterPivots.current.left?.userData.neutralBindQuaternion as THREE.Quaternion
        )?.clone() ?? new THREE.Quaternion();
        w.rightNeutralBindQuaternion = (
          sorterPivots.current.right?.userData.neutralBindQuaternion as THREE.Quaternion
        )?.clone() ?? new THREE.Quaternion();

        publishAuthorCadDetails(scene, variant);

        const planes = planesRef.current;
        (window as unknown as { __KINEMATICS_FREEZE?: unknown }).__KINEMATICS_FREEZE = {
          LEFT_SIGNED_DEG: +THREE.MathUtils.radToDeg(motion.current.leftSigned).toFixed(2),
          RIGHT_SIGNED_DEG: +THREE.MathUtils.radToDeg(motion.current.rightSigned).toFixed(2),
          ANGULAR_SPEED_DEG_PER_SEC: DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC,
          ROTATION_DURATION_S: +(45 / DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC).toFixed(2),
          SAFETY_MARGIN_S: 0.15,
          CONTACT_PLANE_S: planes ? +planes.contactPlaneS.toFixed(4) : null,
          CLEAR_PLANE_S: planes ? +planes.clearPlaneS.toFixed(4) : null,
        };
      }
    }

    return scene;
  }, [gltf, shadows, variant, originX]);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, Math.max(0, delta));
    // One texture-phase writer (clean module); shared textures update for all.
    stepBeltTexturePhase(dt, beltVelocityMps, playbackPaused, variant === 'clean');

    // Visual omega from belt speed / CAD roller radius (PRESENTATION_DERIVED).
    const omega = playbackPaused || beltVelocityMps === 0
      ? 0
      : (beltVelocityMps / Math.max(0.01, rollerRadiusM.current));
    // Prefer canonical speed-derived omega; prop kept for API compat.
    void rollerOmegaRadPerSec;
    if (!playbackPaused) {
      rollerAngle.current += omega * dt;
    }
    for (const pivot of rollerPivots.current) pivot.rotation.z = rollerAngle.current;

    if (variant !== 'sorter') {
      invalidate();
      return;
    }

    // Prefer pivots attached to the live primitive scene (not a stale Strict-Mode clone).
    const fromScene = (root?.userData?.diverterPivots ?? null) as {
      left: THREE.Group; right: THREE.Group;
    } | null;
    const left = fromScene?.left ?? sorterPivots.current.left;
    const right = fromScene?.right ?? sorterPivots.current.right;
    if (!left || !right) return;
    if (root?.userData?.diverterDebug) {
      debugHandles.current = root.userData.diverterDebug as DiverterDebugHandles;
    }

    const leftBind = left.userData.neutralBindQuaternion as THREE.Quaternion | undefined;
    const rightBind = right.userData.neutralBindQuaternion as THREE.Quaternion | undefined;
    if (!leftBind || !rightBind) return;

    const m = motion.current;
    const s = scratch.current;

    if (lastResetEpoch.current !== playbackResetEpoch) {
      lastResetEpoch.current = playbackResetEpoch;
      resetDiverterProductMachine(productMachine.current);
      m.leftCurrent = 0;
      m.rightCurrent = 0;
      m.leftTarget = 0;
      m.rightTarget = 0;
    }

    const w = typeof window !== 'undefined'
      ? (window as unknown as {
          __FORCE_DIVERTER_MOTION_T?: number;
          __FORCE_DIVERTER_SNAP?: boolean;
          __DIVERTER_PRODUCT_INPUT?: {
            productId?: string | null;
            category?: Category | null;
            itemCenterS?: number;
            itemHalfLengthS?: number;
            itemSpeedMps?: number;
            paused?: boolean;
            reset?: boolean;
          };
        })
      : undefined;

    // Optional explicit timer demo (OFF by default).
    if (motionDemoEnabled()) {
      if (!m.demoArmed) {
        m.demoArmed = true;
        m.demoT0Ms = performance.now();
      }
      const forceT = w?.__FORCE_DIVERTER_MOTION_T;
      const tSec = typeof forceT === 'number' && Number.isFinite(forceT)
        ? forceT
        : (performance.now() - m.demoT0Ms) / 1000;
      const mode = demoModeAt(tSec);
      if (mode === 'LEFT_ACTIVE') {
        m.leftTarget = m.leftSigned;
        m.rightTarget = 0;
      } else if (mode === 'RIGHT_ACTIVE') {
        m.leftTarget = 0;
        m.rightTarget = m.rightSigned;
      } else {
        m.leftTarget = 0;
        m.rightTarget = 0;
      }
    } else {
      // Product-synchronized targets (authoritative when demo flag is off).
      const force = w?.__DIVERTER_PRODUCT_INPUT;
      const cat = (force?.category ?? sorterCategory);
      const routeCat =
        cat === 'B' || cat === 'C' || cat === 'D' ? cat : null;
      const pid = force?.productId ?? productId;
      const centerS = force?.itemCenterS
        ?? (typeof itemWorldX === 'number' ? itemWorldX : null);
      const halfS = force?.itemHalfLengthS ?? itemHalfLengthS;
      const speed = force?.itemSpeedMps ?? CONVEYOR_SPEED_MPS;
      const paused = force?.paused ?? playbackPaused;
      const planes = planesRef.current
        ?? buildDiverterPlanes(CAD_MODULE_ORIGINS.sorter + DOWNSTREAM_HINGE_X, 0.702);
      const doReset = !!force?.reset;
      if (doReset && force) force.reset = false; // one-shot

      if (centerS == null || !routeCat || !pid) {
        // No product → stay / return neutral.
        if (productMachine.current.phase === 'READY') {
          m.leftTarget = 0;
          m.rightTarget = 0;
        } else {
          const step = stepDiverterProductMachine(productMachine.current, {
            productId: pid,
            category: routeCat,
            itemCenterS: centerS ?? -10,
            itemHalfLengthS: halfS,
            itemSpeedMps: speed,
            leftCurrentRad: m.leftCurrent,
            rightCurrentRad: m.rightCurrent,
            planes,
            paused,
            reset: doReset,
            nowMs: performance.now(),
          });
          m.leftTarget = step.leftTargetRad;
          m.rightTarget = step.rightTargetRad;
        }
      } else {
        const step = stepDiverterProductMachine(productMachine.current, {
          productId: pid,
          category: routeCat,
          itemCenterS: centerS,
          itemHalfLengthS: halfS,
          itemSpeedMps: speed,
          leftCurrentRad: m.leftCurrent,
          rightCurrentRad: m.rightCurrent,
          planes,
          paused,
          reset: doReset,
          nowMs: performance.now(),
        });
        m.leftTarget = step.leftTargetRad;
        m.rightTarget = step.rightTargetRad;

        if (typeof window !== 'undefined') {
          (window as unknown as { __DIVERTER_PRODUCT_TIMING?: unknown })
            .__DIVERTER_PRODUCT_TIMING = step.telemetry;
        }
      }
    }

    const angleDt = playbackPaused && !motionDemoEnabled() ? 0 : dt;
    if (w?.__FORCE_DIVERTER_SNAP) {
      m.leftCurrent = m.leftTarget;
      m.rightCurrent = m.rightTarget;
    } else {
      m.leftCurrent = moveTowards(m.leftCurrent, m.leftTarget, ANGULAR_SPEED_RAD * angleDt);
      m.rightCurrent = moveTowards(m.rightCurrent, m.rightTarget, ANGULAR_SPEED_RAD * angleDt);
    }

    // Authoritative writer (exactly one): bind × motion about local up.
    s.qMotion.setFromAxisAngle(s.up, m.leftCurrent);
    s.qFinal.copy(leftBind).multiply(s.qMotion);
    left.quaternion.copy(s.qFinal);
    left.rotation.setFromQuaternion(left.quaternion);

    s.qMotion.setFromAxisAngle(s.up, m.rightCurrent);
    s.qFinal.copy(rightBind).multiply(s.qMotion);
    right.quaternion.copy(s.qFinal);
    right.rotation.setFromQuaternion(right.quaternion);

    left.updateMatrix();
    right.updateMatrix();
    left.updateMatrixWorld(true);
    right.updateMatrixWorld(true);
    invalidate();

    // Hinge drift + debug free-end markers.
    left.getWorldPosition(s.hinge);
    if (!m.leftHingeWorld0) m.leftHingeWorld0 = s.hinge.clone();
    const leftDriftMm = s.hinge.distanceTo(m.leftHingeWorld0) * 1000;
    if (leftDriftMm > m.maxLeftHingeDriftMm) m.maxLeftHingeDriftMm = leftDriftMm;

    right.getWorldPosition(s.hinge);
    if (!m.rightHingeWorld0) m.rightHingeWorld0 = s.hinge.clone();
    const rightDriftMm = s.hinge.distanceTo(m.rightHingeWorld0) * 1000;
    if (rightDriftMm > m.maxRightHingeDriftMm) m.maxRightHingeDriftMm = rightDriftMm;

    const leftFreeLocal = left.userData.freeLocal as THREE.Vector3 | undefined;
    const rightFreeLocal = right.userData.freeLocal as THREE.Vector3 | undefined;
    const syncFreeMarker = (
      pivot: THREE.Group,
      freeLocal: THREE.Vector3,
      freeMesh: THREE.Mesh,
      hingeMesh: THREE.Mesh,
      axis: THREE.Line,
    ) => {
      s.free.copy(freeLocal);
      pivot.localToWorld(s.free);
      const moduleRoot = pivot.parent;
      if (moduleRoot) {
        freeMesh.position.copy(s.free);
        moduleRoot.worldToLocal(freeMesh.position);
      } else {
        freeMesh.position.copy(s.free);
      }
      freeMesh.position.y = HINGE_Y + 0.04;
      hingeMesh.position.copy(pivot.userData.hingeRestModule as THREE.Vector3);
      hingeMesh.position.y = HINGE_Y + 0.04;
      setLineEndpoints(axis, freeMesh.position.clone(), hingeMesh.position.clone());
    };

    if (leftFreeLocal && debugHandles.current) {
      syncFreeMarker(
        left, leftFreeLocal,
        debugHandles.current.leftFree,
        debugHandles.current.leftHinge,
        debugHandles.current.leftAxis,
      );
    }
    if (rightFreeLocal && debugHandles.current) {
      syncFreeMarker(
        right, rightFreeLocal,
        debugHandles.current.rightFree,
        debugHandles.current.rightHinge,
        debugHandles.current.rightAxis,
      );
    }

    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __GATE_ANGLES?: { left: number; right: number };
        __GATE_STATE?: unknown;
        __DIVERTER_MOTIONS?: { leftRad: number; rightRad: number };
        __DIVERTER_PLANES?: unknown;
      };
      win.__GATE_ANGLES = {
        left: THREE.MathUtils.radToDeg(m.leftCurrent),
        right: THREE.MathUtils.radToDeg(m.rightCurrent),
      };
      win.__DIVERTER_MOTIONS = { leftRad: m.leftCurrent, rightRad: m.rightCurrent };
      win.__GATE_STATE = {
        phase: productMachine.current.phase,
        leftTargetRad: m.leftTarget,
        rightTargetRad: m.rightTarget,
        leftCurrentRad: m.leftCurrent,
        rightCurrentRad: m.rightCurrent,
        activeProductId: productMachine.current.active?.productId ?? null,
        demoTimer: motionDemoEnabled(),
        maxLeftHingeDriftMm: +m.maxLeftHingeDriftMm.toFixed(3),
        maxRightHingeDriftMm: +m.maxRightHingeDriftMm.toFixed(3),
      };
      win.__DIVERTER_PLANES = planesRef.current;
    }
  });

  return (
    <group position={[originX, CAD_MODULE_Y, 0]} name={`cad-module-${variant}`}>
      <primitive object={root} />
    </group>
  );
}

/** @deprecated alias — prefer ConveyorCadModule */
export function ConveyorCadModel(props: {
  gateOpen?: boolean;
  beltVelocityMps?: number;
  rollerOmegaRadPerSec?: number;
  shadows?: boolean;
  sorterCategory?: Category | null;
  caseElapsedMs?: number;
  productId?: string | null;
  itemWorldX?: number | null;
  itemHalfLengthS?: number;
  playbackPaused?: boolean;
  playbackResetEpoch?: number;
}) {
  return (
    <ConveyorCadModule
      variant="sorter"
      originX={CAD_MODULE_ORIGINS.sorter}
      shadows={props.shadows}
      rollerOmegaRadPerSec={props.rollerOmegaRadPerSec}
      sorterCategory={props.sorterCategory}
      caseElapsedMs={props.caseElapsedMs}
      productId={props.productId}
      itemWorldX={props.itemWorldX}
      itemHalfLengthS={props.itemHalfLengthS}
      playbackPaused={props.playbackPaused}
      playbackResetEpoch={props.playbackResetEpoch}
    />
  );
}

export function preloadConveyorCad() {
  useLoader.preload(GLTFLoader, CONVEYOR_CAD_URL, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  });
}
