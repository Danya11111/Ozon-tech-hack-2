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

      {/* Roll-cage C 1200×800×800 mm — orange */}
      <ZoneBox
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneCZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.C}
        active={active === 'C'}
      />

      {/* Roll-cage D 1200×800×800 mm — purple */}
      <ZoneBox
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneDZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.D}
        active={active === 'D'}
      />
    </group>
  );
}
