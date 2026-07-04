import { Suspense } from 'react';
import type { SimulatedItem, SimulationState } from '../../domain/types';
import { itemPosition3D, ROUTE_COLORS } from './itemMotion';
import { DIMENSION_LIMITS } from '../../domain/classifier';
import { getModelAsset } from '../../data/modelAssets';
import STLModel from './STLModel';

/**
 * Visual scale multiplier for 3D demo visibility.
 * Physical dimensions remain unchanged in data/proof panel.
 * This only affects the rendered mesh size so item is visible in scene.
 */
const VISUAL_SCALE_MULTIPLIER = 2.5;

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
  if (primitive === 'cylinder') {
    return (
      <mesh>
        <cylinderGeometry args={[Math.min(sx, sz) / 2, Math.min(sx, sz) / 2, sy, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
        />
      </mesh>
    );
  }

  if (primitive === 'sphere') {
    return (
      <mesh>
        <sphereGeometry args={[Math.max(sx, sy, sz) / 2, 24, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
        />
      </mesh>
    );
  }

  // default: box
  return (
    <mesh>
      <boxGeometry args={[sx, sy, sz]} />
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
  const dims = currentItem.item.dimensionsMm;
  
  // Physical scale to Three.js units (1 unit = 1 meter, dimensions in mm)
  const physicalSx = Math.max(0.12, Math.min(0.45, dims.width / 1000));
  const physicalSy = Math.max(0.1, Math.min(0.4, dims.height / 1000));
  const physicalSz = Math.max(0.12, Math.min(0.45, dims.depth / 1000));
  
  // Apply visual multiplier for demo visibility (does not affect proof panel data)
  const sx = physicalSx * VISUAL_SCALE_MULTIPLIER;
  const sy = physicalSy * VISUAL_SCALE_MULTIPLIER;
  const sz = physicalSz * VISUAL_SCALE_MULTIPLIER;
  
  const detecting = simulation.machineState === 'DETECTING';
  const moving = simulation.machineState.startsWith('ROUTE_TO_') || 
                 simulation.machineState === 'MOVING_TO_CAMERA' ||
                 simulation.machineState === 'MOVING_TO_GATE';
  const fault = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
  
  // Get model asset for this item
  const asset = getModelAsset(currentItem.item.id);
  const finalColor = fault ? '#fb3d4e' : color;
  const finalEmissive = fault ? '#fb3d4e' : color;
  const finalRoughness = asset?.loaderType === 'stl' ? 0.35 : 0.4;
  // Brighter emissive when moving for visibility
  const emissiveBoost = moving ? 0.55 : 0.35;
  
  // Fallback primitive
  const fallbackPrimitive = asset?.fallbackPrimitive ?? 'box';
  
  return (
    <group position={[x, y, z]}>
      {asset && asset.loaderType === 'stl' && asset.frontendAssetPath ? (
        <Suspense
          fallback={
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
          }
        >
          <STLModel
            path={asset.frontendAssetPath}
            scale={[sx, sy, sz]}
            rotation={[0, 0, 0]}
            position={[0, 0, 0]}
            color={finalColor}
            emissive={finalEmissive}
            emissiveIntensity={emissiveBoost}
            roughness={finalRoughness}
            fallback={
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
            }
          />
        </Suspense>
      ) : (
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
      )}

      {/* Glow ring under item for visibility */}
      <mesh position={[0, -sy / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
        <mesh>
          <boxGeometry args={[sx + 0.12, sy + 0.12, sz + 0.12]} />
          <meshStandardMaterial color="#38bdf8" wireframe transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}
