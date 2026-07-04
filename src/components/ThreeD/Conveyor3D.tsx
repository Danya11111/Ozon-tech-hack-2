import { TWIN_LAYOUT } from './itemMotion';

interface Props {
  stopped: boolean;
}

export default function Conveyor3D({ stopped }: Props) {
  const color = stopped ? '#7f1d1d' : '#1e3a54';
  const beltColor = stopped ? '#991b1b' : '#334155';

  return (
    <group>
      {/* Feed conveyor body */}
      <mesh position={[0, TWIN_LAYOUT.beltY - 0.12, 0]} receiveShadow={false} castShadow={false}>
        <boxGeometry args={[8.6, 0.18, 0.55]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Belt surface */}
      <mesh position={[0, TWIN_LAYOUT.beltY - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.4, 0.48]} />
        <meshStandardMaterial color={beltColor} roughness={0.9} />
      </mesh>

      {/* Accumulator / buffer at end of feed conveyor */}
      <mesh position={[TWIN_LAYOUT.accumulatorX, TWIN_LAYOUT.beltY - 0.05, 0]}>
        <boxGeometry args={[0.9, 0.28, 0.7]} />
        <meshStandardMaterial color={stopped ? '#7f1d1d' : '#0f766e'} roughness={0.7} />
      </mesh>
    </group>
  );
}
