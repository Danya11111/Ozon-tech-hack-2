/**
 * Stage 2B §9 — Intel RealSense Depth Camera D435i (SPEC_DERIVED).
 *
 * Built from the official Intel datasheet dimensions (90 × 25 × 25 mm,
 * 50 mm stereo baseline, depth FOV 87°×58°) and the reference photo:
 * horizontal anodized-aluminium bar, full-width front glass, left/right IR
 * imagers, center RGB module, IR texture projector, rear USB-C, tripod boss.
 * SPEC_DERIVED — not an official Intel CAD file; provenance documented in
 * docs/stage2_real_sorter/camera-realsense-spec.md.
 *
 * Mount: overhead bar across the belt (Z), front glass facing DOWN (-Y),
 * optical center 1.35 m (0.65 m above belt top 0.7 m) — clears the 500 mm
 * oversized item by 112 mm. Laser triangulation module separately at 1.15 m
 * (project doc height), so camera and laser heights are NOT conflated.
 */
import { memo } from 'react';
import { SCAN_START_X, SCAN_END_X } from '../../domain/measurementZone';
import { ZONES, CONVEYOR_WIDTH_M, BELT_TOP_Y } from '../../domain/physicalLayout';

/** Official datasheet dimensions (m). */
export const D435I = {
  width: 0.09,   // 90 mm along the bar (Z when mounted across the belt)
  height: 0.025, // 25 mm
  depth: 0.025,  // 25 mm
  baseline: 0.05,
  fovH: 87, // deg, along the baseline
  fovV: 58, // deg
  opticalCenterY: 1.35,
} as const;

const HOUSING = '#222528';
const HOUSING_EDGE = '#31363b';
const GLASS = '#0c1116';
const LENS_RIM = '#3c4249';
const LENS_INNER = '#05070a';

/** One sensor window on the glass face (rim + recessed lens), facing DOWN (-Y). */
function SensorWindow({ z, radius }: { z: number; radius: number }) {
  const y = -D435I.height / 2 - 0.0004;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.0016, 10, 24]} />
        <meshStandardMaterial color={LENS_RIM} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, y + 0.0008, 0]}>
        <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.0016, 20]} />
        <meshStandardMaterial color={LENS_INNER} metalness={0.4} roughness={0.15} />
      </mesh>
    </group>
  );
}

export const RealSenseD435i = memo(function RealSenseD435i({
  castShadow = false,
}: {
  castShadow?: boolean;
}) {
  const w = D435I.width;
  return (
    // Bar runs across the belt (Z); front glass face looks DOWN (-Y) at the belt.
    <group>
      {/* Main housing bar with chamfered edge rails */}
      <mesh castShadow={castShadow}>
        <boxGeometry args={[D435I.depth - 0.004, D435I.height - 0.004, w]} />
        <meshStandardMaterial color={HOUSING} metalness={0.7} roughness={0.42} />
      </mesh>
      {/* side edge rails (rounded anodized look) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (D435I.depth / 2 - 0.002), 0, 0]}>
          <boxGeometry args={[0.004, D435I.height, w - 0.006]} />
          <meshStandardMaterial color={HOUSING_EDGE} metalness={0.75} roughness={0.35} />
        </mesh>
      ))}
      {/* Full-width front glass on the downward face */}
      <mesh position={[0, -D435I.height / 2 - 0.0006, 0]}>
        <boxGeometry args={[D435I.depth - 0.007, 0.0012, w - 0.008]} />
        <meshPhysicalMaterial
          color={GLASS}
          metalness={0.1}
          roughness={0.08}
          transparent
          opacity={0.82}
        />
      </mesh>
      {/* Sensors along the bar: left imager / RGB / IR projector / right imager */}
      <SensorWindow z={D435I.baseline / 2} radius={0.0065} />
      <SensorWindow z={-D435I.baseline / 2} radius={0.0065} />
      <SensorWindow z={0.012} radius={0.0042} />
      <SensorWindow z={-0.011} radius={0.0052} />
      {/* USB-C port on the right end (rear) */}
      <mesh position={[D435I.depth / 2 - 0.001, 0.002, w / 2 - 0.008]}>
        <boxGeometry args={[0.004, 0.006, 0.009]} />
        <meshStandardMaterial color="#0b0d0f" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Tripod boss on top (mount point) */}
      <mesh position={[0, D435I.height / 2 + 0.003, 0]}>
        <boxGeometry args={[0.012, 0.006, 0.02]} />
        <meshStandardMaterial color={HOUSING_EDGE} metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  );
});

/**
 * Debug-only measurement frustum (§9.4): optical axis, FOV pyramid,
 * scan-zone rectangle on the belt, entry/exit markers.
 */
export const RealSenseFrustumDebug = memo(function RealSenseFrustumDebug() {
  const h = D435I.opticalCenterY - BELT_TOP_Y;
  const halfAlong = Math.tan((D435I.fovV / 2) * (Math.PI / 180)) * h; // along belt X
  const halfAcross = Math.tan((D435I.fovH / 2) * (Math.PI / 180)) * h; // across belt Z
  const cx = ZONES.CAMERA.x;
  const top: [number, number, number] = [cx, D435I.opticalCenterY - D435I.height / 2, 0];
  const y = BELT_TOP_Y;
  const corners: [number, number, number][] = [
    [cx - halfAlong, y, -halfAcross],
    [cx + halfAlong, y, -halfAcross],
    [cx + halfAlong, y, halfAcross],
    [cx - halfAlong, y, halfAcross],
  ];
  return (
    <group>
      {/* optical axis */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              ...top, cx, y, 0,
              // FOV edges
              ...corners.flatMap((c) => [...top, ...c]),
              // FOV footprint rectangle
              ...corners.flatMap((c, i) => [...c, ...corners[(i + 1) % 4]]),
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </lineSegments>
      {/* scan zone rectangle on the belt */}
      <mesh position={[(SCAN_START_X + SCAN_END_X) / 2, y + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCAN_END_X - SCAN_START_X, CONVEYOR_WIDTH_M]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} />
      </mesh>
      {/* entry / exit markers */}
      {[SCAN_START_X, SCAN_END_X].map((x) => (
        <mesh key={x} position={[x, y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.015, CONVEYOR_WIDTH_M]} />
          <meshBasicMaterial color={x === SCAN_START_X ? '#22c55e' : '#ef4444'} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
});
