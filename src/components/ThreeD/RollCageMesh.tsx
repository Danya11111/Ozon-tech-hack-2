/**
 * RollCageMesh — честная сетчатая модель роллтейнера C/D по ground truth.
 *
 * Exterior bounding box: 1200 × 800 × 800 мм (включая колёса) — ROLL_CAGE.
 * Открытый верх, читаемая сетка стен (~100мм), пол-панель на CAGE_FLOOR_Y.
 *
 * Вся геометрия — 3 instanced draw call (трубы+прутья, колёса) + 1 mesh (пол).
 * Shared roll-cage mesh for C/D receivers.
 *
 * Классификация узла (Stage 1 §13.4): PROCEDURAL_FALLBACK — официальной
 * CAD-модели роллтейнера в архивах нет; размеры соответствуют спецификации.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROLL_CAGE, CAGE_FLOOR_Y } from '../../domain/physicalLayout';

const { width: W, depth: D, height: H, wheelRadius: WR, frameThickness: FT } = ROLL_CAGE;
const WHEEL_D = WR * 2; // 0.08m — cage floor height (CAGE_FLOOR_Y)
const BODY_H = H - WHEEL_D; // frame body above wheels; total exterior = H exactly
const ROD = 0.008; // grid rod thickness (8mm wire)
const GRID_STEP = 0.1; // ~100mm grid pitch

interface CageInstances {
  boxes: THREE.Matrix4[];
  wheels: THREE.Matrix4[];
}

/**
 * Stage 2: roll cages are 3-sided with an OPEN FRONT on the conveyor-facing
 * side (real roll-container design) plus a 40mm sill — items enter through
 * the opening from the gravity chute. Matches physicsWorldLayout colliders.
 */
export type CageOpenSide = 'z-' | 'z+' | 'none';

function boxInstance(x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Deterministic instance layout for the cage (built once per open side). */
function buildInstances(openSide: CageOpenSide): CageInstances {
  const boxes: THREE.Matrix4[] = [];
  const yBot = WHEEL_D; // bottom of frame body
  const yTop = H; // top of frame body (exterior top)
  const openSign = openSide === 'z-' ? -1 : openSide === 'z+' ? 1 : 0;

  // 4 corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      boxes.push(boxInstance(sx * (W / 2 - FT / 2), yBot + BODY_H / 2, sz * (D / 2 - FT / 2), FT, BODY_H, FT));
    }
  }
  // bottom + top frame rectangles (skip the open side's tubes; sill added below)
  for (const y of [yBot + FT / 2, yTop - FT / 2]) {
    for (const sz of [-1, 1]) {
      if (sz === openSign && y === yTop - FT / 2) continue; // open front: no top tube
      boxes.push(boxInstance(0, y, sz * (D / 2 - FT / 2), W, FT, FT));
    }
    boxes.push(boxInstance(W / 2 - FT / 2, y, 0, FT, FT, D - FT * 2));
    boxes.push(boxInstance(-(W / 2 - FT / 2), y, 0, FT, FT, D - FT * 2));
  }
  // 40mm sill across the open front (matches entry-sill collider)
  if (openSign !== 0) {
    boxes.push(boxInstance(0, yBot + 0.02, openSign * (D / 2 - FT / 2), W, 0.04, FT));
  }

  // grid walls between frames (interior span)
  const yGridBot = yBot + FT;
  const yGridTop = yTop - FT;
  const gridH = yGridTop - yGridBot;
  const yMid = yGridBot + gridH / 2;
  const xInner = W / 2 - FT; // inner half-width
  const zInner = D / 2 - FT;

  // front/back walls (z = ±(D/2 − ROD/2)): vertical + horizontal rods
  const vCols = Math.floor((xInner * 2) / GRID_STEP) - 1; // exclude corners (posts)
  const hRows = Math.max(1, Math.round(gridH / GRID_STEP) - 1);
  for (const sz of [-1, 1]) {
    if (sz === openSign) continue; // open front: no grid wall
    const z = sz * (D / 2 - ROD / 2);
    for (let i = 1; i <= vCols; i++) {
      const x = -xInner + (i * (xInner * 2)) / (vCols + 1);
      boxes.push(boxInstance(x, yMid, z, ROD, gridH, ROD));
    }
    for (let r = 1; r <= hRows; r++) {
      const y = yGridBot + (r * gridH) / (hRows + 1);
      boxes.push(boxInstance(0, y, z, W - FT * 2, ROD, ROD));
    }
  }
  // side walls (x = ±(W/2 − ROD/2))
  const sCols = Math.floor((zInner * 2) / GRID_STEP) - 1;
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - ROD / 2);
    for (let i = 1; i <= sCols; i++) {
      const z = -zInner + (i * (zInner * 2)) / (sCols + 1);
      boxes.push(boxInstance(x, yMid, z, ROD, gridH, ROD));
    }
    for (let r = 1; r <= hRows; r++) {
      const y = yGridBot + (r * gridH) / (hRows + 1);
      boxes.push(boxInstance(x, y, 0, ROD, ROD, D - FT * 2));
    }
  }

  // caster wheels (lying cylinders)
  const wheels: THREE.Matrix4[] = [];
  const wheelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      wheels.push(new THREE.Matrix4().compose(
        new THREE.Vector3(sx * (W / 2 - 0.08), WR, sz * (D / 2 - 0.08)),
        wheelQuat,
        new THREE.Vector3(1, 1, 1),
      ));
    }
  }

  return { boxes, wheels };
}

export default function RollCageMesh({ color, active = false, shadows = false, openSide = 'none' }: {
  color: string;
  active?: boolean;
  shadows?: boolean;
  openSide?: CageOpenSide;
}) {
  const instances = useMemo(() => buildInstances(openSide), [openSide]);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wheelGeo = useMemo(() => new THREE.CylinderGeometry(WR, WR, 0.03, 12), []);
  const boxesRef = useRef<THREE.InstancedMesh>(null);
  const wheelsRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const boxes = boxesRef.current;
    if (boxes) {
      instances.boxes.forEach((m, i) => boxes.setMatrixAt(i, m));
      boxes.instanceMatrix.needsUpdate = true;
    }
    const wheels = wheelsRef.current;
    if (wheels) {
      instances.wheels.forEach((m, i) => wheels.setMatrixAt(i, m));
      wheels.instanceMatrix.needsUpdate = true;
    }
  }, [instances]);

  useEffect(() => () => {
    boxGeo.dispose();
    wheelGeo.dispose();
  }, [boxGeo, wheelGeo]);

  const emissiveIntensity = active ? 0.35 : 0;

  return (
    <group>
      {/* frame + grid walls: single instanced draw call */}
      <instancedMesh
        ref={boxesRef}
        args={[boxGeo, undefined, instances.boxes.length]}
        castShadow={shadows}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </instancedMesh>

      {/* caster wheels: single instanced draw call */}
      <instancedMesh ref={wheelsRef} args={[wheelGeo, undefined, instances.wheels.length]}>
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </instancedMesh>

      {/* interior floor pan where items rest (top at CAGE_FLOOR_Y) */}
      <mesh position={[0, CAGE_FLOOR_Y - 0.005, 0]} receiveShadow={shadows}>
        <boxGeometry args={[W - FT, 0.01, D - FT]} />
        <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  );
}
