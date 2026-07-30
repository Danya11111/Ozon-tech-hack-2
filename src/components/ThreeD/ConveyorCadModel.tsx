/**
 * Stage 2 — CAD-derived conveyor (runtime GLB from 3d_models/conveer.FCStd).
 *
 * Asset: public/models/sorter/conveyor-web.glb (159k tris, 555 KB, Draco).
 * Node statuses: REAL_CAD (all groups; see docs/stage2_real_sorter/mechanism-map.md).
 * Animation (domain-synced via refs/useFrame, no per-frame React state):
 *  - stop-gate/* barriers: vertical lift stroke 80 mm, eased ~300 ms
 *  - rollers/Ролик*, rollers/Вал: spin ω = beltVelocity / 0.025 m
 * GLB vertices are baked in module coordinates — animated meshes are re-pivoted
 * around their own bbox center at load time.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const CONVEYOR_CAD_URL = '/models/sorter/conveyor-web.glb';

/** World placement: CAD camera arch lands on the domain inspection point. */
export const CONVEYOR_CAD_POSITION: [number, number, number] = [-2.02, 0.594, 0];
/** CAD module world span after placement (m). */
export const CONVEYOR_CAD_SPAN_X: [number, number] = [-2.086, -0.076];

const GATE_STROKE_M = 0.08;
const GATE_SPEED_PER_SEC = 1 / 0.3;

const MATERIALS: Record<string, THREE.MeshStandardMaterial> = {};
function materialFor(slot: string): THREE.MeshStandardMaterial {
  if (!MATERIALS[slot]) {
    const defs: Record<string, { color: string; metalness: number; roughness: number }> = {
      'painted-metal': { color: '#8b9cae', metalness: 0.55, roughness: 0.45 },
      'brushed-metal': { color: '#b9c2cc', metalness: 0.9, roughness: 0.3 },
      'rubber-belt': { color: '#39424a', metalness: 0.0, roughness: 0.92 },
      'dark-mechanical': { color: '#3a4148', metalness: 0.6, roughness: 0.5 },
      'safety-yellow': { color: '#f5b301', metalness: 0.2, roughness: 0.55 },
    };
    const def = defs[slot] ?? defs['painted-metal'];
    // Stage 2C §9.1 — opaque machine metals: no accidental alpha / DoubleSide bleed.
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

function slotFor(nodeName: string): string {
  const grp = nodeName.split('/')[0];
  switch (grp) {
    case 'conveyor-belt': return 'rubber-belt';
    case 'rollers': return 'brushed-metal';
    case 'motor-and-drive': return 'dark-mechanical';
    case 'stop-gate': return 'safety-yellow';
    case 'pusher-servo': return 'dark-mechanical';
    case 'inspection-frame': return 'painted-metal';
    default: return 'painted-metal';
  }
}

/** Re-pivot a world-baked mesh around its own bbox center; returns the pivot group. */
function repivot(mesh: THREE.Mesh): THREE.Group {
  const parent = mesh.parent;
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.name = `pivot/${mesh.name}`;
  pivot.position.copy(center);
  pivot.userData.baseY = center.y;
  mesh.position.sub(center);
  pivot.add(mesh);
  parent?.add(pivot);
  return pivot;
}

export function ConveyorCadModel({
  gateOpen,
  beltVelocityMps,
  rollerOmegaRadPerSec,
  shadows = false,
}: {
  gateOpen: boolean;
  beltVelocityMps: number;
  rollerOmegaRadPerSec: number;
  shadows?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, CONVEYOR_CAD_URL, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  });

  const gatePivots = useRef<THREE.Group[]>([]);
  const rollerPivots = useRef<THREE.Group[]>([]);
  const gateOpenAmount = useRef(0);
  const rollerAngle = useRef(0);

  const root = useMemo(() => {
    gatePivots.current = [];
    rollerPivots.current = [];
    const scene = gltf.scene.clone(true);
    const toPivot: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name || '';
      mesh.material = materialFor(slotFor(name));
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      // Force opaque even if a future GLB embeds transparent materials.
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      if (name.startsWith('stop-gate/') || name.startsWith('rollers/Ролик') || name.startsWith('rollers/Вал')) {
        toPivot.push(mesh);
      }
    });
    for (const mesh of toPivot) {
      const pivot = repivot(mesh);
      if (mesh.name.startsWith('stop-gate/')) gatePivots.current.push(pivot);
      else rollerPivots.current.push(pivot);
    }
    return scene;
  }, [gltf, shadows]);

  useEffect(() => () => {
    // Materials are module-cached; geometry belongs to the shared GLTF cache.
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    // Stop-gate barriers: eased lift (extend/hold/retract), no teleport.
    const target = gateOpen ? 1 : 0;
    const cur = gateOpenAmount.current;
    const next = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), GATE_SPEED_PER_SEC * delta);
    gateOpenAmount.current = next;
    const eased = next < 0.5 ? 2 * next * next : 1 - Math.pow(-2 * next + 2, 2) / 2;
    for (const pivot of gatePivots.current) {
      pivot.position.y = (pivot.userData.baseY as number) + GATE_STROKE_M * eased;
    }
    // Rollers: ω = v / r, angle integrated in a ref (belt velocity already 0 on halt).
    rollerAngle.current += rollerOmegaRadPerSec * delta;
    for (const pivot of rollerPivots.current) {
      pivot.rotation.z = rollerAngle.current;
    }
  });

  return <primitive object={root} position={CONVEYOR_CAD_POSITION} />;
}

export function preloadConveyorCad() {
  useLoader.preload(GLTFLoader, CONVEYOR_CAD_URL, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  });
}
