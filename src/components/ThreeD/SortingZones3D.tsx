import type { Category } from '../../domain/types';
import { ROUTE_COLORS, TWIN_LAYOUT } from './itemMotion';
import RollCageMesh from './RollCageMesh';

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

/** Roll-cage for C/D zones — shared instanced mesh (exterior 1200×800×800 incl. wheels), open top */
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
      <RollCageMesh color={color} active={active} />

      {/* Floor highlight for active cage */}
      {active && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
  const beltY = TWIN_LAYOUT.beltY;

  return (
    <group>
      {/* Zone A feed — pad under belt (aligned to shared belt height) */}
      <ZoneBox
        position={[TWIN_LAYOUT.startX, beltY / 2, 0]}
        size={[1.0, beltY, 1.0]}
        color="#38bdf8"
        active={active === undefined}
      />

      {/* Zone B main sorter — green, straight */}
      <ZoneBox
        position={[TWIN_LAYOUT.zoneBX, beltY / 2, 0]}
        size={[1.2, beltY, 1.2]}
        color={ROUTE_COLORS.B}
        active={active === 'B'}
      />

      {/* Roll-cage C 1200×800×800 mm — orange, ground-origin shared mesh */}
      <RollCage
        position={[TWIN_LAYOUT.gateX + 0.4, 0, TWIN_LAYOUT.zoneCZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.C}
        active={active === 'C'}
      />

      {/* Roll-cage D 1200×800×800 mm — purple, ground-origin shared mesh */}
      <RollCage
        position={[TWIN_LAYOUT.gateX + 0.4, 0, TWIN_LAYOUT.zoneDZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.D}
        active={active === 'D'}
      />
    </group>
  );
}
