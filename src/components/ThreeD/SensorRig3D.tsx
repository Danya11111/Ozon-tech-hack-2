import type { SimulationState } from '../../domain/types';
import { TWIN_LAYOUT } from './itemMotion';

interface Props {
  sensors: SimulationState['sensors'];
  machineState: SimulationState['machineState'];
}

function SensorPole({
  x,
  active,
  labelColor,
  height = 0.9,
}: {
  x: number;
  active: boolean;
  labelColor: string;
  height?: number;
}) {
  return (
    <group position={[x, 0, -0.55]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, height, 0.2]}>
        <boxGeometry args={[0.28, 0.16, 0.22]} />
        <meshStandardMaterial
          color={active ? labelColor : '#1e293b'}
          emissive={active ? labelColor : '#000000'}
          emissiveIntensity={active ? 0.55 : 0}
        />
      </mesh>
    </group>
  );
}

export default function SensorRig3D({ sensors, machineState }: Props) {
  const detecting = machineState === 'DETECTING';

  return (
    <group>
      <SensorPole x={TWIN_LAYOUT.cameraX} active={sensors.camera.active || detecting} labelColor="#38bdf8" />
      <SensorPole x={TWIN_LAYOUT.laserX} active={sensors.laser.active} labelColor="#22d3ee" />
      <SensorPole x={TWIN_LAYOUT.ultrasonicX} active={sensors.ultrasound.active} labelColor="#67e8f9" height={0.75} />

      {detecting ? (
        <mesh position={[TWIN_LAYOUT.cameraX, TWIN_LAYOUT.beltY + 0.35, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.55]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} emissive="#38bdf8" emissiveIntensity={0.4} />
        </mesh>
      ) : null}
    </group>
  );
}
