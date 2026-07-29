/**
 * RealItemModel — единый loader для официальных real-model ассетов.
 *
 * Контракт (одинаковый для STL сейчас и GLB позже):
 *   manifest (modelAssets.ts) → нормализованная геометрия → mesh.
 *
 * Нормализация запекается в клон геометрии один раз при загрузке:
 *   1. rotation из manifest (в мм-пространстве источника);
 *   2. uniform scale 0.001 (mm → meters);
 *   3. pivot → bottom-center (центр footprint по X/Z, низ по Y);
 *   4. computeVertexNormals.
 *
 * Shared loader cache никогда не мутируется (clone перед transforms),
 * dispose вызывается только для локального клона.
 */

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelAsset } from '../../data/modelAssets';

export interface RealItemMaterial {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}

interface InnerProps {
  asset: ModelAsset;
  material: RealItemMaterial;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Normalize a freshly cloned geometry per manifest rules.
 * Returns the clone with transforms BAKED IN (pivot = bottom-center, meters).
 */
export function normalizeGeometryClone(source: THREE.BufferGeometry, asset: ModelAsset): THREE.BufferGeometry {
  const g = source.clone();
  const [rx, ry, rz] = asset.rotation;
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.scale(0.001, 0.001, 0.001); // mm → m, uniform (scaleMode: 'uniform-mm-to-m')
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  g.translate(-cx, -bb.min.y, -cz); // pivotMode: 'bottom-center'
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

function RealItemModelInner({ asset, material, castShadow, receiveShadow }: InnerProps) {
  const shared = useLoader(STLLoader, asset.runtimePath!) as THREE.BufferGeometry;
  const geometry = useMemo(() => normalizeGeometryClone(shared, asset), [shared, asset]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
      <meshStandardMaterial
        color={material.color}
        emissive={material.emissive ?? material.color}
        emissiveIntensity={material.emissiveIntensity ?? 0.05}
        roughness={material.roughness ?? 0.6}
        metalness={material.metalness ?? 0.05}
      />
    </mesh>
  );
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface BoundaryState {
  failed: boolean;
}

/** Per-item error boundary: load failure → procedural fallback, no scene crash. */
class ItemModelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.warn('[RealItemModel] asset load failed, procedural fallback engaged:', error.message);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface RealItemModelProps extends InnerProps {
  /** Procedural fallback node (load failure AND suspense placeholder). */
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

export default function RealItemModel({ fallback, ...inner }: RealItemModelProps) {
  if (!inner.asset.runtimePath) {
    return <>{fallback}</>;
  }
  return (
    <ItemModelErrorBoundary fallback={fallback} onError={inner.onError}>
      <Suspense fallback={fallback}>
        <RealItemModelInner {...inner} />
      </Suspense>
    </ItemModelErrorBoundary>
  );
}

/** Preload a runtime asset into the shared loader cache (deduped by URL). */
export function preloadRealItemModel(runtimePath: string): void {
  useLoader.preload(STLLoader, runtimePath);
}
