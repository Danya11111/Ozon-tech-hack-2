import type { Category, MachineState } from '../../domain/types';
import { ROUTE_COLORS, TWIN_LAYOUT } from './itemMotion';

interface Props {
  category?: Category;
  machineState: MachineState;
}

function RouteBeam({
  start,
  end,
  color,
  active,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  active: boolean;
}) {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dz * dz) || 0.1;
  const angle = Math.atan2(dz, dx);

  // Much thicker and brighter active route
  const thickness = active ? 0.12 : 0.04;
  const width = active ? 0.22 : 0.08;

  return (
    <group>
      {/* Main route beam */}
      <mesh position={mid} rotation={[0, -angle, 0]}>
        <boxGeometry args={[length, thickness, width]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={active ? 1 : 0.3}
          emissive={color}
          emissiveIntensity={active ? 0.8 : 0.12}
        />
      </mesh>
      
      {/* Glow layer for active route */}
      {active && (
        <mesh position={[mid[0], mid[1] - 0.02, mid[2]]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[length, 0.02, width + 0.1]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.5}
            emissive={color}
            emissiveIntensity={1.0}
          />
        </mesh>
      )}
    </group>
  );
}

export default function RouteArrows3D({ category, machineState }: Props) {
  const routing = machineState.startsWith('ROUTE_TO_');
  const classifying = machineState === 'CLASSIFYING';
  const preview = classifying || routing || Boolean(category);
  const y = TWIN_LAYOUT.beltY + 0.05;
  const from: [number, number, number] = [TWIN_LAYOUT.gateX, y, 0];

  return (
    <group>
      {/* Always draw B/C/D routes in distinct colors; active route is brighter */}
      <RouteBeam
        start={from}
        end={[TWIN_LAYOUT.zoneBX, y, 0]}
        color={ROUTE_COLORS.B}
        active={preview && category === 'B'}
      />
      <RouteBeam
        start={from}
        end={[TWIN_LAYOUT.gateX + 0.4, y, TWIN_LAYOUT.zoneCZ]}
        color={ROUTE_COLORS.C}
        active={preview && category === 'C'}
      />
      <RouteBeam
        start={from}
        end={[TWIN_LAYOUT.gateX + 0.4, y, TWIN_LAYOUT.zoneDZ]}
        color={ROUTE_COLORS.D}
        active={preview && category === 'D'}
      />
    </group>
  );
}
