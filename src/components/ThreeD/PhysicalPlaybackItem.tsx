import { memo, useEffect, useMemo } from 'react';
import { getPhysicalItemPose } from '../../domain/physicalItemMotion';
import { getModelAsset } from '../../data/modelAssets';
import { resolveItem } from '../../data/resolveItem';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { classifyItem } from '../../domain/classifier';
import { getRenderedItemDimensions } from '../../domain/physicalLayout';
import * as THREE from 'three';
import RealItemModel, { isProductAssetReady } from './RealItemModel';
import { ItemVerificationOverlay } from './RealModelVerification';
import { CATEGORY_COLORS, INDUSTRIAL_PALETTE } from '../../domain/industrialTheme';

const COLORS = {
  B: CATEGORY_COLORS.B,
  C: CATEGORY_COLORS.C,
  D: CATEGORY_COLORS.D,
  sensorAccent: INDUSTRIAL_PALETTE.sensorAccent,
};

/** Base real-model materials per SKU (Stage 1 §20 — basic, form-revealing). */
const ITEM_MATERIALS: Record<string, { color: string; roughness: number; metalness?: number }> = {
  'SKU-001': { color: '#b68b58', roughness: 0.82 },          // cardboard
  'SKU-002': { color: '#e8eef6', roughness: 0.5 },           // lunchbox plastic
  'SKU-003': { color: '#93c5fd', roughness: 0.38 },          // detergent jug plastic
  'SKU-004': { color: '#c49a6c', roughness: 0.82 },          // cardboard
  'SKU-005': { color: '#a78bfa', roughness: 0.92 },          // soft pouf fabric
  'SKU-006': { color: '#f8fafc', roughness: 0.42 },          // plate ceramic
  'SKU-007': { color: '#7dd3fc', roughness: 0.28 },          // bottle plastic
  'SKU-008': { color: '#cbd5e1', roughness: 0.35, metalness: 0.15 },
  'SKU-009': { color: '#475569', roughness: 0.5 },           // pen body
};

interface RenderProps {
  color: string;
  accentColor: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}

function FallbackPrimitive({ type, color, accentColor, emissiveIntensity, roughness, metalness, w, h, d, castShadow }: RenderProps & {
  type: 'box' | 'cylinder' | 'sphere';
  w: number; h: number; d: number;
  castShadow?: boolean;
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
    <mesh geometry={geometry} castShadow={castShadow}>
      <meshStandardMaterial color={color} emissive={accentColor} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/** Inner visual content of an item (shared by kinematic and physics drivers). */
export function ItemVisualContent({
  caseData,
  phase,
  surface,
  isSettled,
  castShadow = false,
  verifySku = null,
  onVisualReady,
}: {
  caseData: PlaylistCase;
  phase: string;
  surface: string;
  isSettled: boolean;
  castShadow?: boolean;
  verifySku?: string | null;
  /** Fires once the visible mesh (real or procedural) is ready to show. */
  onVisualReady?: () => void;
}) {
  const itemData = useMemo(() => resolveItem(caseData.itemId), [caseData.itemId]);
  const classification = useMemo(() => classifyItem(itemData), [itemData]);
  const itemId = itemData.id.replace('-LC', '');
  const asset = getModelAsset(itemId);
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);

  const isRouting = phase === 'routing';
  const onTransport = surface === 'main_belt'
    || surface === 'inspection_station'
    || surface === 'routing_junction'
    || surface === 'b_transfer';

  const routeAccent = COLORS[classification.category] ?? COLORS.sensorAccent;
  const material = ITEM_MATERIALS[itemId] ?? { color: '#d8c3a5', roughness: 0.75 };
  const bodyColor = phase === 'fault' ? '#ef4444' : material.color;
  const accentColor = isSettled ? '#94a3b8' : routeAccent;
  const emissiveIntensity = phase === 'fault' ? 0.25 : isRouting ? 0.12 : isSettled ? 0.01 : 0.03;
  const metalness = material.metalness ?? 0.05;

  // Real official model is the default when the manifest provides one;
  // procedural fallback only for missing assets or load failure (Stage 1 §15.1).
  const useReal = Boolean(asset?.defaultRealAsset && asset?.runtimePath);
  const fallbackType = asset?.fallbackPrimitive ?? 'box';

  // Pose position is the EXPECTED bbox center (surfaceY + h/2). Real models use
  // a bottom-center pivot, so the mesh is offset down by half the model height.
  // Contact epsilon vs the surface is therefore exactly 0 mm by construction.
  const modelHeightM = asset?.worldExpectedMm
    ? asset.worldExpectedMm.y / 1000
    : dims.height;
  const pivotOffsetY = -modelHeightM / 2;

  // Procedural / already-cached assets are ready immediately.
  useEffect(() => {
    if (!useReal || !asset?.runtimePath || isProductAssetReady(asset.runtimePath)) {
      onVisualReady?.();
    }
  }, [useReal, asset?.runtimePath, caseData.id, onVisualReady]);

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
      castShadow={castShadow}
    />
  );

  const verifying = verifySku != null && verifySku === itemId && asset != null;

  return (
    <>
      {useReal && asset ? (
        <group position={[0, pivotOffsetY, 0]}>
          <RealItemModel
            asset={asset}
            material={{
              color: bodyColor,
              emissive: accentColor,
              emissiveIntensity,
              roughness: material.roughness,
              metalness,
            }}
            castShadow={castShadow}
            fallback={fallback}
            onReady={onVisualReady}
          />
        </group>
      ) : (
        fallback
      )}

      {verifying && asset && (
        <ItemVerificationOverlay
          asset={asset}
          pivotOffsetY={pivotOffsetY}
          cardY={modelHeightM + 0.3}
          fallbackSizeM={{ x: dims.width, y: dims.height, z: dims.depth }}
        />
      )}

      {isSettled && (
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
    </>
  );
}

export const PhysicalPlaybackItem = memo(function PhysicalPlaybackItem({
  caseData,
  elapsedMs,
  slotIndex = 0,
  jitter,
  castShadow = false,
  verifySku = null,
}: {
  caseData: PlaylistCase;
  elapsedMs: number;
  slotIndex?: number;
  jitter?: { x: number; z: number; yaw: number };
  castShadow?: boolean;
  /** Stage 1 verification: SKU to overlay (null = off, 'follow' handled by caller passing current SKU). */
  verifySku?: string | null;
}) {
  const itemData = useMemo(() => resolveItem(caseData.itemId), [caseData.itemId]);
  const classification = useMemo(() => classifyItem(itemData), [itemData]);

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

  if (elapsedMs < 0) return null;

  return (
    <group position={position} rotation={rotation}>
      <ItemVisualContent
        caseData={caseData}
        phase={phase}
        surface={surface}
        isSettled={isSettled}
        castShadow={castShadow}
        verifySku={verifySku}
      />
    </group>
  );
});
