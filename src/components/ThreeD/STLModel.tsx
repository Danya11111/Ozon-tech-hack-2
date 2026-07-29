/**
 * STLModel component — loads and displays STL models.
 * Uses STLLoader from three/examples.
 */

import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Center } from '@react-three/drei';
import type { BufferGeometry, Mesh as ThreeMesh } from 'three';
import { Suspense, useRef, useEffect, useMemo } from 'react';

interface STLModelProps {
  /** Path to STL file in public folder */
  path: string;
  
  /** Scale factor [x, y, z] */
  scale: [number, number, number];
  
  /** Rotation [x, y, z] in radians */
  rotation?: [number, number, number];
  
  /** Position offset [x, y, z] */
  position?: [number, number, number];
  
  /** Material color */
  color: string;
  
  /** Emissive color (for glow effect) */
  emissive?: string;
  
  /** Emissive intensity */
  emissiveIntensity?: number;
  
  /** Roughness */
  roughness?: number;
  
  /** Fallback component if loading fails */
  fallback?: React.ReactNode;
}

/**
 * Outer wrapper: Suspense boundary around the loader. Load errors propagate
 * to the nearest ErrorBoundary (hooks must not live inside try/catch).
 */
export default function STLModel(props: STLModelProps) {
  return (
    <Suspense fallback={props.fallback ? <>{props.fallback}</> : null}>
      <STLModelInner {...props} />
    </Suspense>
  );
}

function STLModelInner({
  path,
  scale,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  color,
  emissive,
  emissiveIntensity = 0.2,
  roughness = 0.5,
}: STLModelProps) {
  const meshRef = useRef<ThreeMesh>(null);

  const shared = useLoader(STLLoader, path) as BufferGeometry;

  // Clone the loader-cached geometry before centering so the shared cache
  // entry is never mutated; dispose the clone on unmount.
  const geometry = useMemo(() => {
    const g = shared.clone();
    g.center();
    g.computeVertexNormals();
    return g;
  }, [shared]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <Center position={position} rotation={rotation}>
      <mesh ref={meshRef} geometry={geometry} scale={scale}>
        <meshStandardMaterial
          color={color}
          emissive={emissive ?? color}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
        />
      </mesh>
    </Center>
  );
}
