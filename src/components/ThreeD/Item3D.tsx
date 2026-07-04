import { Suspense } from 'react';
import type { SimulatedItem, SimulationState } from '../../domain/types';
import { itemPosition3D, ROUTE_COLORS } from './itemMotion';
import { DIMENSION_LIMITS } from '../../domain/classifier';
import { getModelAsset } from '../../data/modelAssets';
import STLModel from './STLModel';

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
}: {
  primitive: 'box' | 'cylinder' | 'sphere';
  sx: number;
  sy: number;
  sz: number;
  color: string;
  emissive: string;
  roughness: number;
}) {
  if (primitive === 'cylinder') {
    return (
      <mesh>
        <cylinderGeometry args={[Math.min(sx, sz) / 2, Math.min(sx, sz) / 2, sy, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.2}
          roughness={roughness}
        />
      </mesh>
    );
  }

  if (primitive === 'sphere') {
    return (
      <mesh>
        <sphereGeometry args={[Math.max(sx, sy, sz) / 2, 16, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.2}
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
        emissiveIntensity={0.2}
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
  
  // Scale to Three.js units (1 unit = 1 meter, dimensions in mm)
  const sx = Math.max(0.12, Math.min(0.45, dims.width / 1000));
  const sy = Math.max(0.1, Math.min(0.4, dims.height / 1000));
  const sz = Math.max(0.12, Math.min(0.45, dims.depth / 1000));
  
  const detecting = simulation.machineState === 'DETECTING';
  const fault = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
  
  // Get model asset for this item
  const asset = getModelAsset(currentItem.item.id);
  const finalColor = fault ? '#fb3d4e' : color;
  const finalEmissive = fault ? '#fb3d4e' : color;
  const finalRoughness = asset?.loaderType === 'stl' ? 0.45 : 0.5;
  
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
            emissiveIntensity={0.2}
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
        />
      )}

      {detecting ? (
        <mesh>
          <boxGeometry args={[sx + 0.08, sy + 0.08, sz + 0.08]} />
          <meshStandardMaterial color="#38bdf8" wireframe transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
}
