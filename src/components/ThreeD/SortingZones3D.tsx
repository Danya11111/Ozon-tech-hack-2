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
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={active ? 0.5 : 0.22}
        emissive={color}
        emissiveIntensity={active ? 0.4 : 0.12}
      />
    </mesh>
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
          opacity={active ? 0.25 : 0.1}
          emissive={color}
          emissiveIntensity={active ? 0.3 : 0.08}
        />
      </mesh>
      
      {/* Cage wireframe edges (visible frame) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color={color} linewidth={active ? 2 : 1} opacity={active ? 1 : 0.6} transparent />
      </lineSegments>
      
      {/* Vertical posts (corners) for visual emphasis */}
      {[
        [-size[0] / 2, 0, -size[2] / 2],
        [size[0] / 2, 0, -size[2] / 2],
        [-size[0] / 2, 0, size[2] / 2],
        [size[0] / 2, 0, size[2] / 2],
      ].map((offset, i) => (
        <mesh key={i} position={offset as [number, number, number]}>
          <boxGeometry args={[0.04, size[1], 0.04]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
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
