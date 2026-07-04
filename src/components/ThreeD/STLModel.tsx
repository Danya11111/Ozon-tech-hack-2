/**
 * STLModel component — loads and displays STL models.
 * Uses STLLoader from three/examples.
 */

import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Center } from '@react-three/drei';
import type { BufferGeometry, Mesh as ThreeMesh } from 'three';
import { useRef, useEffect } from 'react';

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

export default function STLModel({
  path,
  scale,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  color,
  emissive,
  emissiveIntensity = 0.2,
  roughness = 0.5,
  fallback,
}: STLModelProps) {
  const meshRef = useRef<ThreeMesh>(null);
  
  let geometry: BufferGeometry | null = null;
  
  try {
    // Load STL geometry
    geometry = useLoader(STLLoader, path);
  } catch (error) {
    console.warn(`Failed to load STL model: ${path}`, error);
    return fallback ? <>{fallback}</> : null;
  }
  
  // Center the geometry on load
  useEffect(() => {
    if (meshRef.current && geometry) {
      geometry.center();
      geometry.computeVertexNormals();
    }
  }, [geometry]);
  
  if (!geometry) {
    return fallback ? <>{fallback}</> : null;
  }
  
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
