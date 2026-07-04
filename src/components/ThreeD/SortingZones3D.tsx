import * as THREE from 'three';
import type { Category } from '../../domain/types';
import { ROUTE_COLORS, TWIN_LAYOUT } from './itemMotion';

interface Props {
  activeCategory?: Category;
  activeRoute?: Category;
}

function ZoneBox({
  position,
  size,
  color,
  active,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={active ? 0.6 : 0.2}
          emissive={color}
          emissiveIntensity={active ? 0.7 : 0.1}
        />
      </mesh>
      {/* Highlight ring for active zone */}
      {active && (
        <mesh position={[0, size[1] / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size[0] * 0.4, size[0] * 0.55, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.0}
            transparent
            opacity={0.8}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}

/** Roll-cage with wireframe edges for C/D zones */
function RollCage({
  position,
  size,
  color,
  active,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      {/* Cage body (transparent) */}
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={active ? 0.4 : 0.15}
          emissive={color}
          emissiveIntensity={active ? 0.6 : 0.1}
        />
      </mesh>
      
      {/* Cage wireframe edges (visible frame) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color={color} linewidth={active ? 3 : 1} opacity={active ? 1 : 0.5} transparent />
      </lineSegments>
      
      {/* Vertical posts (corners) for visual emphasis - thicker */}
      {[
        [-size[0] / 2, 0, -size[2] / 2],
        [size[0] / 2, 0, -size[2] / 2],
        [-size[0] / 2, 0, size[2] / 2],
        [size[0] / 2, 0, size[2] / 2],
      ].map((offset, i) => (
        <mesh key={i} position={offset as [number, number, number]}>
          <boxGeometry args={[0.06, size[1], 0.06]} />
          <meshStandardMaterial 
            color={color} 
            metalness={0.4} 
            roughness={0.6}
            emissive={active ? color : '#000000'}
            emissiveIntensity={active ? 0.3 : 0}
          />
        </mesh>
      ))}
      
      {/* Floor highlight for active cage */}
      {active && (
        <mesh position={[0, -size[1] / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size[0] * 0.9, size[2] * 0.9]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

export default function SortingZones3D({ activeCategory, activeRoute }: Props) {
  const active = activeRoute ?? activeCategory;
  const cage = TWIN_LAYOUT.rollCageSize;

  return (
    <group>
      {/* Zone A feed — always visible cyan */}
      <ZoneBox
        position={[TWIN_LAYOUT.startX, 0.22, 0]}
        size={[1.0, 0.44, 1.0]}
        color="#38bdf8"
        active={active === undefined}
      />

      {/* Zone B main sorter — green, straight */}
      <ZoneBox
        position={[TWIN_LAYOUT.zoneBX, 0.28, 0]}
        size={[1.2, 0.56, 1.2]}
        color={ROUTE_COLORS.B}
        active={active === 'B'}
      />

      {/* Roll-cage C 1200×800×800 mm — orange with wireframe */}
      <RollCage
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneCZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.C}
        active={active === 'C'}
      />

      {/* Roll-cage D 1200×800×800 mm — purple with wireframe */}
      <RollCage
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneDZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.D}
        active={active === 'D'}
      />
    </group>
  );
}
