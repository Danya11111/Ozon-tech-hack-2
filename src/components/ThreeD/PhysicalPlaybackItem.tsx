import { Suspense, memo, useEffect, useMemo } from 'react';
import { getPhysicalItemPose } from '../../domain/physicalItemMotion';
import { getModelAsset } from '../../data/modelAssets';
import { resolveItem } from '../../data/resolveItem';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { classifyItem } from '../../domain/classifier';
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

interface RenderProps {
  color: string;
  accentColor: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}

function STLGeometry({ path, scale, color, accentColor, emissiveIntensity, roughness, metalness }: RenderProps & {
  path: string;
  scale: [number, number, number];
}) {
  const geometry = useLoader(STLLoader, path) as THREE.BufferGeometry;
  useMemo(() => {
    if (geometry) {
      geometry.center();
      geometry.computeVertexNormals();
    }
  }, [geometry]);
  return (
    <group scale={scale}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
      </mesh>
    </group>
  );
}

function FallbackPrimitive({ type, color, accentColor, emissiveIntensity, roughness, metalness, w, h, d }: RenderProps & {
  type: 'box' | 'cylinder' | 'sphere';
  w: number; h: number; d: number;
}) {
  const geometry = useMemo<THREE.BufferGeometry>(() => {
    if (type === 'cylinder' || type === 'sphere') {
      const r = Math.max(w, d) / 2;
      return new THREE.CylinderGeometry(r, r, h, 16);
    }
    return new THREE.BoxGeometry(w, h, d);
  }, [type, w, h, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

export const PhysicalPlaybackItem = memo(function PhysicalPlaybackItem({
  caseData,
  elapsedMs,
  slotIndex = 0,
  jitter,
}: {
  caseData: PlaylistCase;
  elapsedMs: number;
  slotIndex?: number;
  jitter?: { x: number; z: number; yaw: number };
}) {
  const itemData = useMemo(() => resolveItem(caseData.itemId), [caseData.itemId]);
  const classification = useMemo(() => classifyItem(itemData), [itemData]);
  const itemId = itemData.id.replace('-LC', '');
  const asset = getModelAsset(itemId);
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);

  const pose = getPhysicalItemPose({
    caseId: caseData.id,
    slotIndex,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: classification.category,
    elapsedMs,
    faultType: caseData.faultType,
    jitter,
  });

  const { position, rotation, phase, surface, isSettled } = pose;
  const isRouting = phase === 'routing';
  const useSimplifiedMesh = phase === 'settled' || isSettled;
  const onTransport = surface === 'main_belt'
    || surface === 'inspection_station'
    || surface === 'routing_junction'
    || surface === 'b_transfer';

  if (elapsedMs < 0) return null;

  const routeAccent = COLORS[classification.category] ?? COLORS.sensorAccent;
  const material = ITEM_MATERIALS[itemId] ?? { color: '#d8c3a5', roughness: 0.75 };
  const bodyColor = phase === 'fault' ? '#ef4444' : useSimplifiedMesh ? (material.color ?? '#b8b2a8') : material.color;
  const accentColor = useSimplifiedMesh ? '#94a3b8' : routeAccent;
  const emissiveIntensity = useSimplifiedMesh
    ? 0.01
    : (phase === 'fault' ? 0.25 : isRouting ? 0.12 : 0.03);
  const metalness = material.metalness ?? 0.05;
  const useSTL = !useSimplifiedMesh && asset?.loaderType === 'stl' && asset?.frontendAssetPath;
  const stlPath = asset?.frontendAssetPath ?? '';
  const fallbackType = asset?.fallbackPrimitive ?? 'box';

  const fallback = (
    <FallbackPrimitive
      type={fallbackType}
      color={bodyColor}
      accentColor={accentColor}
      emissiveIntensity={emissiveIntensity}
      roughness={material.roughness}
      metalness={metalness}
      w={dims.width}
      h={dims.height}
      d={dims.depth}
    />
  );

  return (
    <group position={position} rotation={rotation}>
      {useSTL ? (
        <Suspense fallback={fallback}>
          <STLGeometry
            path={stlPath}
            scale={[0.001, 0.001, 0.001]}
            color={bodyColor}
            accentColor={accentColor}
            emissiveIntensity={emissiveIntensity}
            roughness={material.roughness}
            metalness={metalness}
          />
        </Suspense>
      ) : (
        fallback
      )}

      {useSimplifiedMesh && (
        <mesh position={[0, -dims.height / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(dims.width, dims.depth) * 0.35, Math.max(dims.width, dims.depth) * 0.42, 20]} />
          <meshBasicMaterial color={routeAccent} transparent opacity={0.5} />
        </mesh>
      )}

      {onTransport && (
        <mesh position={[0, -dims.height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(dims.width, dims.depth) / 2 + 0.01, 16]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
});
