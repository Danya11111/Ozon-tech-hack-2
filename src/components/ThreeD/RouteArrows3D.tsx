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

  return (
    <mesh position={mid} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, 0.04, active ? 0.12 : 0.06]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={active ? 0.95 : 0.25}
        emissive={color}
        emissiveIntensity={active ? 0.5 : 0.05}
      />
    </mesh>
  );
}

export default function RouteArrows3D({ category, machineState }: Props) {
  const routing = machineState.startsWith('ROUTE_TO_');
  const classifying = machineState === 'CLASSIFYING';
  const preview = classifying || routing;
  const y = TWIN_LAYOUT.beltY + 0.05;
  const from: [number, number, number] = [TWIN_LAYOUT.gateX, y, 0];

  return (
    <group>
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
