import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SimulatedItem, SimulationState } from '../../domain/types';
import { itemPosition3D, ROUTE_COLORS } from './itemMotion';
import { getModelAsset } from '../../data/modelAssets';
import { getRenderedItemDimensions } from '../../domain/physicalLayout';
import RealItemModel from './RealItemModel';

/**
 * Stage 1: VISUAL_SCALE_MULTIPLIER (2.5x) and the 0.12–0.45m clamps removed.
 * `/details` now renders the same true physical scale as `/` (1 unit = 1m),
 * with the shared manifest transform (bottom-center pivot, mm→m uniform).
 */

interface Props {
  simulation: SimulationState;
  currentItem?: SimulatedItem;
}

function FallbackPrimitive({
  primitive,
  sx,
  sy,
  sz,
  color,
  emissive,
  roughness,
  emissiveIntensity = 0.35,
}: {
  primitive: 'box' | 'cylinder' | 'sphere';
  sx: number;
  sy: number;
  sz: number;
  color: string;
  emissive: string;
  roughness: number;
  emissiveIntensity?: number;
}) {
  const geometry = useMemo<THREE.BufferGeometry>(() => {
    if (primitive === 'cylinder') {
      return new THREE.CylinderGeometry(Math.min(sx, sz) / 2, Math.min(sx, sz) / 2, sy, 24);
    }
    if (primitive === 'sphere') {
      return new THREE.SphereGeometry(Math.max(sx, sy, sz) / 2, 24, 16);
    }
    return new THREE.BoxGeometry(sx, sy, sz);
  }, [primitive, sx, sy, sz]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // center-pivot primitives are lifted so their bottom touches the surface
  return (
    <mesh geometry={geometry} position={[0, sy / 2, 0]}>
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
      />
    </mesh>
  );
}

export default function Item3D({ simulation, currentItem }: Props) {
  if (!currentItem) {
    return null;
  }

  const [x, y, z] = itemPosition3D(simulation);
  const category = currentItem.classification.category;
  const color = ROUTE_COLORS[category] ?? '#38bdf8';
  const dims = getRenderedItemDimensions(currentItem.item.dimensionsMm);
  const sx = dims.width;
  const sy = dims.height;
  const sz = dims.depth;

  const detecting = simulation.machineState === 'DETECTING';
  const moving = simulation.machineState.startsWith('ROUTE_TO_') ||
                 simulation.machineState === 'MOVING_TO_CAMERA' ||
                 simulation.machineState === 'MOVING_TO_GATE';
  const fault = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';

  const asset = getModelAsset(currentItem.item.id);
  const finalColor = fault ? '#fb3d4e' : color;
  const finalEmissive = fault ? '#fb3d4e' : color;
  const finalRoughness = asset?.defaultRealAsset ? 0.35 : 0.4;
  const emissiveBoost = moving ? 0.55 : 0.35;

  const fallbackPrimitive = asset?.fallbackPrimitive ?? 'box';
  const useReal = Boolean(asset?.defaultRealAsset && asset?.runtimePath);

  const fallback = (
    <FallbackPrimitive
      primitive={fallbackPrimitive}
      sx={sx}
      sy={sy}
      sz={sz}
      color={finalColor}
      emissive={finalEmissive}
      roughness={finalRoughness}
      emissiveIntensity={emissiveBoost}
    />
  );

  return (
    <group position={[x, y, z]}>
      {useReal && asset ? (
        <RealItemModel
          asset={asset}
          material={{
            color: finalColor,
            emissive: finalEmissive,
            emissiveIntensity: emissiveBoost,
            roughness: finalRoughness,
          }}
          fallback={fallback}
        />
      ) : (
        fallback
      )}

      {/* Glow ring at the contact plane under the item */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(sx, sz) * 0.4, Math.max(sx, sz) * 0.6, 32]} />
        <meshStandardMaterial
          color={finalColor}
          emissive={finalColor}
          emissiveIntensity={moving ? 0.8 : 0.4}
          transparent
          opacity={moving ? 0.7 : 0.4}
        />
      </mesh>

      {detecting ? (
        <mesh position={[0, sy / 2, 0]}>
          <boxGeometry args={[sx + 0.12, sy + 0.12, sz + 0.12]} />
          <meshStandardMaterial color="#38bdf8" wireframe transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}
