import type { SimulatedItem, SimulationState } from '../../domain/types';
import { itemPosition3D, ROUTE_COLORS } from './itemMotion';

interface Props {
  simulation: SimulationState;
  currentItem?: SimulatedItem;
}

export default function Item3D({ simulation, currentItem }: Props) {
  if (!currentItem) {
    return null;
  }

  const [x, y, z] = itemPosition3D(simulation);
  const category = currentItem.classification.category;
  const color = ROUTE_COLORS[category] ?? '#38bdf8';
  const dims = currentItem.item.dimensionsMm;
  const sx = Math.max(0.12, Math.min(0.45, dims.width / 1000));
  const sy = Math.max(0.1, Math.min(0.4, dims.height / 1000));
  const sz = Math.max(0.12, Math.min(0.45, dims.depth / 1000));
  const isRound =
    currentItem.item.shape.includes('round') ||
    currentItem.item.shape.includes('cylinder') ||
    currentItem.item.roundness >= 0.8;
  const detecting = simulation.machineState === 'DETECTING';
  const fault =
    simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';

  return (
    <group position={[x, y, z]}>
      {isRound ? (
        <mesh>
          <cylinderGeometry args={[Math.min(sx, sz) / 2, Math.min(sx, sz) / 2, sy, 16]} />
          <meshStandardMaterial
            color={fault ? '#fb3d4e' : color}
            emissive={fault ? '#fb3d4e' : color}
            emissiveIntensity={0.2}
            roughness={0.45}
          />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial
            color={fault ? '#fb3d4e' : color}
            emissive={fault ? '#fb3d4e' : color}
            emissiveIntensity={0.2}
            roughness={0.5}
          />
        </mesh>
      )}

      {detecting ? (
        <mesh>
          <boxGeometry args={[sx + 0.08, sy + 0.08, sz + 0.08]} />
          <meshStandardMaterial color="#38bdf8" wireframe transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
}
