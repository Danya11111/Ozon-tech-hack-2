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
        opacity={active ? 0.45 : 0.18}
        emissive={color}
        emissiveIntensity={active ? 0.35 : 0.05}
      />
    </mesh>
  );
}

export default function SortingZones3D({ activeCategory, activeRoute }: Props) {
  const active = activeRoute ?? activeCategory;
  const cage = TWIN_LAYOUT.rollCageSize;

  return (
    <group>
      {/* Zone A feed */}
      <ZoneBox
        position={[TWIN_LAYOUT.startX, 0.2, 0]}
        size={[0.9, 0.4, 0.9]}
        color="#38bdf8"
        active={!active}
      />

      {/* Zone B main sorter — straight */}
      <ZoneBox
        position={[TWIN_LAYOUT.zoneBX, 0.25, 0]}
        size={[1.1, 0.5, 1.1]}
        color={ROUTE_COLORS.B}
        active={active === 'B'}
      />

      {/* Roll-cage C 1200×800×800 mm */}
      <ZoneBox
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneCZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.C}
        active={active === 'C'}
      />

      {/* Roll-cage D 1200×800×800 mm */}
      <ZoneBox
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y / 2, TWIN_LAYOUT.zoneDZ]}
        size={[cage.x, cage.y, cage.z]}
        color={ROUTE_COLORS.D}
        active={active === 'D'}
      />
    </group>
  );
}
