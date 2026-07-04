import type { SimulationState } from '../../domain/types';
import { pusherOffset, TWIN_LAYOUT } from './itemMotion';

interface Props {
  gate: SimulationState['gate'];
  actuators: SimulationState['actuators'];
  machineState: SimulationState['machineState'];
}

export default function Actuator3D({ gate, actuators, machineState }: Props) {
  const gateOpen = gate.open;
  const pusherC = pusherOffset(actuators.pusherC);
  const pusherD = pusherOffset(actuators.pusherD);
  const fault = machineState === 'FAULT' || machineState === 'EMERGENCY_STOP';

  return (
    <group>
      {/* Stop-gate */}
      <mesh
        position={[TWIN_LAYOUT.gateX, TWIN_LAYOUT.beltY + 0.2, 0]}
        rotation={[0, 0, gateOpen ? -0.7 : 0]}
      >
        <boxGeometry args={[0.06, 0.55, 0.62]} />
        <meshStandardMaterial
          color={fault ? '#fb3d4e' : gateOpen ? '#4ade80' : '#f87171'}
          emissive={fault ? '#fb3d4e' : '#000000'}
          emissiveIntensity={fault ? 0.4 : 0}
        />
      </mesh>

      {/* Pusher C → roll-cage C */}
      <mesh position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY + 0.12, pusherC]}>
        <boxGeometry args={[0.35, 0.18, 0.18]} />
        <meshStandardMaterial
          color={actuators.pusherC === 'extended' ? '#f59e0b' : '#78350f'}
          emissive={actuators.pusherC === 'extended' ? '#f59e0b' : '#000000'}
          emissiveIntensity={actuators.pusherC === 'extended' ? 0.35 : 0}
        />
      </mesh>

      {/* Pusher D → roll-cage D */}
      <mesh position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY + 0.12, -pusherD]}>
        <boxGeometry args={[0.35, 0.18, 0.18]} />
        <meshStandardMaterial
          color={actuators.pusherD === 'extended' ? '#c084fc' : '#4c1d95'}
          emissive={actuators.pusherD === 'extended' ? '#c084fc' : '#000000'}
          emissiveIntensity={actuators.pusherD === 'extended' ? 0.35 : 0}
        />
      </mesh>
    </group>
  );
}
