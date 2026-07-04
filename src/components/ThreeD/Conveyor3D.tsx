import { TWIN_LAYOUT } from './itemMotion';

interface Props {
  stopped: boolean;
}

export default function Conveyor3D({ stopped }: Props) {
  // Brighter colors for better visibility
  const color = stopped ? '#7f1d1d' : '#3b5998';
  const beltColor = stopped ? '#991b1b' : '#5a6577';
  const accColor = stopped ? '#7f1d1d' : '#14b8a6';
  const sideGuardColor = '#6b7a8f';
  const rollerColor = '#8b9cb0';

  return (
    <group>
      {/* Feed conveyor body */}
      <mesh position={[0, TWIN_LAYOUT.beltY - 0.12, 0]} receiveShadow={false} castShadow={false}>
        <boxGeometry args={[8.6, 0.18, 0.58]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.25} />
      </mesh>

      {/* Belt surface */}
      <mesh position={[0, TWIN_LAYOUT.beltY - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.4, 0.5]} />
        <meshStandardMaterial color={beltColor} roughness={0.75} />
      </mesh>
      
      {/* Conveyor side guards (borders) - brighter for visibility */}
      <mesh position={[0, TWIN_LAYOUT.beltY + 0.06, 0.3]}>
        <boxGeometry args={[8.4, 0.12, 0.04]} />
        <meshStandardMaterial color={sideGuardColor} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, TWIN_LAYOUT.beltY + 0.06, -0.3]}>
        <boxGeometry args={[8.4, 0.12, 0.04]} />
        <meshStandardMaterial color={sideGuardColor} metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Rollers (visual indication of conveyor mechanism) — spaced every 1.2m */}
      {[-3.6, -2.4, -1.2, 0, 1.2].map((x) => (
        <mesh key={x} position={[x, TWIN_LAYOUT.beltY - 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.52, 12]} />
          <meshStandardMaterial color={rollerColor} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Accumulator / buffer at end of feed conveyor — explicit raised pocket */}
      <group position={[TWIN_LAYOUT.accumulatorX, TWIN_LAYOUT.beltY, 0]}>
        {/* Accumulator floor (raised pocket) */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[1.05, 0.12, 0.82]} />
          <meshStandardMaterial color={accColor} roughness={0.65} emissive={accColor} emissiveIntensity={0.15} />
        </mesh>
        
        {/* Accumulator walls — three sides (back + left + right) */}
        <mesh position={[0, 0.12, 0.38]}>
          <boxGeometry args={[1.05, 0.28, 0.06]} />
          <meshStandardMaterial color="#14b8a6" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.12, -0.38]}>
          <boxGeometry args={[1.05, 0.28, 0.06]} />
          <meshStandardMaterial color="#14b8a6" roughness={0.7} />
        </mesh>
        <mesh position={[-0.48, 0.12, 0]}>
          <boxGeometry args={[0.06, 0.28, 0.82]} />
          <meshStandardMaterial color="#14b8a6" roughness={0.7} />
        </mesh>
        
        {/* Direction arrow (subtle indication of flow) */}
        <mesh position={[0.2, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial 
            color="#5eead4" 
            transparent 
            opacity={0.4} 
            side={2} 
          />
        </mesh>
      </group>
    </group>
  );
}
