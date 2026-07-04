import { TWIN_LAYOUT } from './itemMotion';

interface Props {
  stopped: boolean;
}

export default function Conveyor3D({ stopped }: Props) {
  const color = stopped ? '#7f1d1d' : '#1e3a54';
  const beltColor = stopped ? '#991b1b' : '#334155';
  const accColor = stopped ? '#7f1d1d' : '#0f766e';

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

      {/* Accumulator / buffer at end of feed conveyor — explicit raised pocket */}
      <group position={[TWIN_LAYOUT.accumulatorX, TWIN_LAYOUT.beltY, 0]}>
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[1.05, 0.12, 0.82]} />
          <meshStandardMaterial color={accColor} roughness={0.65} emissive={accColor} emissiveIntensity={0.15} />
        </mesh>
        {/* Side walls of accumulator */}
        <mesh position={[0, 0.12, 0.38]}>
          <boxGeometry args={[1.05, 0.28, 0.06]} />
          <meshStandardMaterial color="#14b8a6" />
        </mesh>
        <mesh position={[0, 0.12, -0.38]}>
          <boxGeometry args={[1.05, 0.28, 0.06]} />
          <meshStandardMaterial color="#14b8a6" />
        </mesh>
        <mesh position={[-0.48, 0.12, 0]}>
          <boxGeometry args={[0.06, 0.28, 0.82]} />
          <meshStandardMaterial color="#14b8a6" />
        </mesh>
      </group>
    </group>
  );
}
