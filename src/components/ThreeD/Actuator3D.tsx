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
  
  // Support post color - brighter for visibility
  const postColor = '#7a8a9f';

  return (
    <group>
      {/* Stop-gate — vertical lift mechanism */}
      <group position={[TWIN_LAYOUT.gateX, TWIN_LAYOUT.beltY, 0]}>
        {/* Gate support posts (left and right) - larger and brighter */}
        <mesh position={[0, 0.38, -0.4]}>
          <boxGeometry args={[0.06, 0.76, 0.06]} />
          <meshStandardMaterial color={postColor} metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.38, 0.4]}>
          <boxGeometry args={[0.06, 0.76, 0.06]} />
          <meshStandardMaterial color={postColor} metalness={0.4} roughness={0.6} />
        </mesh>
        
        {/* Cross bar at top */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.88]} />
          <meshStandardMaterial color={postColor} metalness={0.4} roughness={0.6} />
        </mesh>
        
        {/* Gate plate — moves up/down - larger and brighter */}
        <mesh position={[0, gateY, 0]}>
          <boxGeometry args={[0.1, 0.08, 0.72]} />
          <meshStandardMaterial
            color={fault ? '#fb3d4e' : gateOpen ? '#4ade80' : '#f87171'}
            emissive={fault ? '#fb3d4e' : gateOpen ? '#4ade80' : '#f87171'}
            emissiveIntensity={fault ? 0.6 : gateOpen ? 0.4 : 0.3}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      </group>

      {/* Pusher C → roll-cage C (extended plate) - brighter orange */}
      <group position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY, 0]}>
        {/* Pusher base (stationary) - visible base */}
        <mesh position={[0, 0.12, 0.12]}>
          <boxGeometry args={[0.2, 0.2, 0.15]} />
          <meshStandardMaterial color="#b45309" roughness={0.7} metalness={0.2} />
        </mesh>
        
        {/* Pusher plate (moves) - larger and brighter */}
        <mesh position={[0, 0.14, pusherC + 0.15]}>
          <boxGeometry args={[0.35, 0.2, 0.25]} />
          <meshStandardMaterial
            color={actuators.pusherC === 'extended' ? '#fbbf24' : '#d97706'}
            emissive={actuators.pusherC === 'extended' ? '#fbbf24' : '#d97706'}
            emissiveIntensity={actuators.pusherC === 'extended' ? 0.6 : 0.2}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      </group>

      {/* Pusher D → roll-cage D (extended plate) - brighter purple */}
      <group position={[TWIN_LAYOUT.gateX - 0.1, TWIN_LAYOUT.beltY, 0]}>
        {/* Pusher base (stationary) - visible base */}
        <mesh position={[0, 0.12, -0.12]}>
          <boxGeometry args={[0.2, 0.2, 0.15]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.7} metalness={0.2} />
        </mesh>
        
        {/* Pusher plate (moves) - larger and brighter */}
        <mesh position={[0, 0.14, -pusherD - 0.15]}>
          <boxGeometry args={[0.35, 0.2, 0.25]} />
          <meshStandardMaterial
            color={actuators.pusherD === 'extended' ? '#d8b4fe' : '#a78bfa'}
            emissive={actuators.pusherD === 'extended' ? '#d8b4fe' : '#a78bfa'}
            emissiveIntensity={actuators.pusherD === 'extended' ? 0.6 : 0.2}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}
