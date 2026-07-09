import { Suspense, useMemo } from 'react';
import { getPhysicalItemPose } from '../../domain/physicalItemMotion';
import { getModelAsset } from '../../data/modelAssets';
import { ITEMS } from '../../data/items';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { getRenderedItemDimensions } from '../../domain/physicalLayout';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const COLORS = {
  B: '#16a34a',
  C: '#ea580c',
  D: '#7c3aed',
  sensorAccent: '#3b82f6',
};

const ITEM_MATERIALS: Record<string, { color: string; roughness: number; metalness?: number }> = {
  'SKU-001': { color: '#b68b58', roughness: 0.82 },
  'SKU-002': { color: '#e8eef6', roughness: 0.5 },
  'SKU-004': { color: '#c49a6c', roughness: 0.82 },
  'SKU-006': { color: '#f8fafc', roughness: 0.42 },
  'SKU-007': { color: '#7dd3fc', roughness: 0.28 },
  'SKU-008': { color: '#cbd5e1', roughness: 0.35, metalness: 0.15 },
  'SKU-011': { color: '#cbd5e1', roughness: 0.35, metalness: 0.15 },
};

function STLGeometry({ path, scale, color, accentColor, emissiveIntensity, roughness, metalness }: any) {
  const geometry = useLoader(STLLoader, path) as THREE.BufferGeometry;
  useMemo(() => {
    if (geometry) {
      geometry.center();
      geometry.computeVertexNormals();
    }
  }, [geometry]);
  return (
    <group scale={scale}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
      </mesh>
      <lineSegments geometry={new THREE.EdgesGeometry(geometry, 35)}>
        <lineBasicMaterial color={accentColor} transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

function FallbackPrimitive({ type, color, accentColor, emissiveIntensity, roughness, metalness, w, h, d }: any) {
  if (type === 'cylinder' || type === 'sphere') {
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[Math.max(w, d) / 2, Math.max(w, d) / 2, h, 16]} />
          <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d), 35]} />
        <lineBasicMaterial color={accentColor} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

export function PhysicalPlaybackItem({ 
  caseData, 
  elapsedMs, 
  slotIndex = 0 
}: { 
  caseData: PlaylistCase; 
  elapsedMs: number;
  slotIndex?: number;
}) {
  const itemId = caseData.itemId.replace('-LC', '');
  const itemData = useMemo(() => ITEMS.find(i => i.id === itemId) ?? ITEMS[0], [itemId]);
  const asset = getModelAsset(itemId);
  
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);
  
  const pose = getPhysicalItemPose({
    caseId: caseData.id,
    slotIndex,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: caseData.expectedCategory,
    elapsedMs
  });

  const { position, rotation, isSettled, phase, surface } = pose;
  const isRouting = phase === 'routing';
  // Item rests on a moving/transport surface (shadow makes sense there).
  const onTransport = surface === 'main_belt'
    || surface === 'inspection_station'
    || surface === 'routing_junction'
    || surface === 'b_receiver';

  // Before spawn, don't show
  if (elapsedMs < 0) return null;

  const accentColor = COLORS[caseData.expectedCategory] ?? COLORS.sensorAccent;
  const material = ITEM_MATERIALS[itemId] ?? { color: '#d8c3a5', roughness: 0.75 };
  const emissiveIntensity = isRouting ? 0.16 : 0.03;
  
  const useSTL = asset?.loaderType === 'stl' && asset?.frontendAssetPath;
  const stlPath = asset?.frontendAssetPath ?? '';
  const fallbackType = asset?.fallbackPrimitive ?? 'box';

  return (
    <group position={position} rotation={rotation}>
      {useSTL ? (
        <Suspense fallback={<FallbackPrimitive type={fallbackType} color={material.color} accentColor={accentColor} emissiveIntensity={emissiveIntensity} roughness={material.roughness} metalness={material.metalness ?? 0.05} w={dims.width} h={dims.height} d={dims.depth} />}>
          <STLGeometry path={stlPath} scale={[0.001, 0.001, 0.001]} color={material.color} accentColor={accentColor} emissiveIntensity={emissiveIntensity} roughness={material.roughness} metalness={material.metalness ?? 0.05} />
        </Suspense>
      ) : (
        <FallbackPrimitive type={fallbackType} color={material.color} accentColor={accentColor} emissiveIntensity={emissiveIntensity} roughness={material.roughness} metalness={material.metalness ?? 0.05} w={dims.width} h={dims.height} d={dims.depth} />
      )}
      
      {/* Contact shadow only while riding a transport surface */}
      {onTransport && (
        <mesh position={[0, -dims.height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(dims.width, dims.depth) / 2 + 0.01, 16]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}
