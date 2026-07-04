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
  
  // Gate vertical lift: closed (Y = 0.2) → open (Y = 0.65)
  const gateY = gateOpen ? 0.65 : 0.2;

  return (
    <group>
      {/* Stop-gate — vertical lift mechanism */}
      <group position={[TWIN_LAYOUT.gateX, TWIN_LAYOUT.beltY, 0]}>
        {/* Gate support posts (left and right) */}
        <mesh position={[0, 0.35, -0.35]}>
          <boxGeometry args={[0.04, 0.7, 0.04]} />
          <meshStandardMaterial color="#475569" metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.35, 0.35]}>
          <boxGeometry args={[0.04, 0.7, 0.04]} />
          <meshStandardMaterial color="#475569" metalness={0.3} roughness={0.7} />
        </mesh>
        
        {/* Gate plate — moves up/down */}
        <mesh position={[0, gateY, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.65]} />
          <meshStandardMaterial
            color={fault ? '#fb3d4e' : gateOpen ? '#4ade80' : '#f87171'}
            emissive={fault ? '#fb3d4e' : '#000000'}
            emissiveIntensity={fault ? 0.4 : gateOpen ? 0.15 : 0}
            metalness={0.2}
            roughness={0.6}
          />
        </mesh>
      </group>

      {/* Pusher C → roll-cage C (extended plate) */}
      <group position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY, 0]}>
        {/* Pusher base (stationary) */}
        <mesh position={[0, 0.12, 0.1]}>
          <boxGeometry args={[0.15, 0.18, 0.12]} />
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
        
        {/* Pusher plate (moves) */}
        <mesh position={[0, 0.12, pusherC]}>
          <boxGeometry args={[0.3, 0.15, 0.2]} />
          <meshStandardMaterial
            color={actuators.pusherC === 'extended' ? '#f59e0b' : '#92400e'}
            emissive={actuators.pusherC === 'extended' ? '#f59e0b' : '#000000'}
            emissiveIntensity={actuators.pusherC === 'extended' ? 0.35 : 0}
            roughness={0.65}
          />
        </mesh>
      </group>

      {/* Pusher D → roll-cage D (extended plate) */}
      <group position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY, 0]}>
        {/* Pusher base (stationary) */}
        <mesh position={[0, 0.12, -0.1]}>
          <boxGeometry args={[0.15, 0.18, 0.12]} />
          <meshStandardMaterial color="#4c1d95" roughness={0.8} />
        </mesh>
        
        {/* Pusher plate (moves) */}
        <mesh position={[0, 0.12, -pusherD]}>
          <boxGeometry args={[0.3, 0.15, 0.2]} />
          <meshStandardMaterial
            color={actuators.pusherD === 'extended' ? '#c084fc' : '#581c87'}
            emissive={actuators.pusherD === 'extended' ? '#c084fc' : '#000000'}
            emissiveIntensity={actuators.pusherD === 'extended' ? 0.35 : 0}
            roughness={0.65}
          />
        </mesh>
      </group>
    </group>
  );
}
