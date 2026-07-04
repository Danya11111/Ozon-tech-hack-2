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
    <group position={[x, 0, -0.6]}>
      {/* Pole - brighter */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#6b7a8f" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Sensor head - larger and brighter */}
      <mesh position={[0, height, 0.22]}>
        <boxGeometry args={[0.32, 0.2, 0.26]} />
        <meshStandardMaterial
          color={active ? labelColor : '#3d4a5c'}
          emissive={active ? labelColor : '#000000'}
          emissiveIntensity={active ? 0.7 : 0}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
      {/* Lens indicator */}
      <mesh position={[0, height, 0.36]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
        <meshStandardMaterial
          color={active ? '#ffffff' : '#2a3444'}
          emissive={active ? labelColor : '#000000'}
          emissiveIntensity={active ? 0.9 : 0}
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

      {/* Detection beam - more visible */}
      {detecting ? (
        <group>
          {/* Main detection plane */}
          <mesh position={[TWIN_LAYOUT.cameraX, TWIN_LAYOUT.beltY + 0.4, 0]}>
            <boxGeometry args={[0.8, 0.03, 0.6]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} emissive="#38bdf8" emissiveIntensity={0.7} />
          </mesh>
          {/* Scan line effect */}
          <mesh position={[TWIN_LAYOUT.cameraX, TWIN_LAYOUT.beltY + 0.2, 0]}>
            <boxGeometry args={[0.02, 0.4, 0.6]} />
            <meshStandardMaterial color="#67e8f9" transparent opacity={0.6} emissive="#67e8f9" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
