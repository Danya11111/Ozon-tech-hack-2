/**
 * RealModelVerification — Stage 1 debug overlay (?stage1=1&verify=real-models).
 *
 * Read-only instrumentation: bounding box, axes, pivot marker, bottom contact
 * plane и информационная панель (источник, формат, размеры, статус валидации).
 * Рендерится только в verification mode; business state не изменяется.
 *
 * Использование: <ItemVerificationOverlay> внутри pose-группы товара
 * (PhysicalPlaybackItem) — следует за товаром по маршруту B/C/D.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelAsset } from '../../data/modelAssets';
import { normalizeGeometryClone } from './RealItemModel';

export interface SizeM {
  x: number;
  y: number;
  z: number;
}

const AXIS_COLORS = { x: '#ef4444', y: '#22c55e', z: '#3b82f6' } as const;

/** Wire bbox + axis tripod + pivot marker + bottom contact plane (bottom-center space). */
function VerificationGizmos({ sizeM }: { sizeM: SizeM }) {
  const boxEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(sizeM.x, sizeM.y, sizeM.z);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [sizeM.x, sizeM.y, sizeM.z]);
  const axes = useMemo(() => ({
    x: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, 0, 0)]),
    y: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.15, 0)]),
    z: new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.15)]),
  }), []);
  useEffect(() => () => {
    boxEdges.dispose();
    axes.x.dispose();
    axes.y.dispose();
    axes.z.dispose();
  }, [boxEdges, axes]);

  return (
    <group>
      {/* bounding box of the normalized model (bottom-center pivot) */}
      <lineSegments geometry={boxEdges} position={[0, sizeM.y / 2, 0]}>
        <lineBasicMaterial color="#facc15" />
      </lineSegments>
      {/* axis tripod at pivot (footprint center, bottom point) */}
      <lineSegments geometry={axes.x}><lineBasicMaterial color={AXIS_COLORS.x} /></lineSegments>
      <lineSegments geometry={axes.y}><lineBasicMaterial color={AXIS_COLORS.y} /></lineSegments>
      <lineSegments geometry={axes.z}><lineBasicMaterial color={AXIS_COLORS.z} /></lineSegments>
      {/* pivot marker */}
      <mesh position={[0, 0.004, 0]}>
        <sphereGeometry args={[0.008, 12, 8]} />
        <meshBasicMaterial color="#facc15" depthTest={false} />
      </mesh>
      {/* bottom contact plane (item footprint on the surface) */}
      <mesh position={[0, 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sizeM.x, sizeM.z]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

function InfoCard({ asset, measuredM, y }: {
  asset: ModelAsset;
  measuredM: SizeM | null;
  y: number;
}) {
  const mm = (m: number) => (m * 1000).toFixed(1);
  const expected = asset.worldExpectedMm;
  const rows: Array<[string, string]> = [
    ['Model', asset.displayName],
    ['Badge', asset.defaultRealAsset ? 'REAL (official)' : 'FALLBACK · NO_EXACT_OFFICIAL_MODEL'],
    ['Source', asset.sourceFile ?? 'n/a'],
    ['SHA-256', asset.sourceSha256 ? `${asset.sourceSha256.slice(0, 12)}…` : 'n/a'],
    ['Format', asset.runtimeFormat ?? 'procedural'],
    ['File size', asset.fileSizeBytes != null ? `${(asset.fileSizeBytes / 1024).toFixed(0)} KB` : 'n/a'],
    ['Triangles', asset.triangleCount != null ? String(asset.triangleCount) : 'n/a'],
    ['Conversion', asset.conversionStatus],
    ['Pivot', asset.pivotMode],
  ];
  if (expected) rows.push(['Expected x/y/z mm', `${expected.x} / ${expected.y} / ${expected.z}`]);
  if (measuredM) rows.push(['Measured x/y/z mm', `${mm(measuredM.x)} / ${mm(measuredM.y)} / ${mm(measuredM.z)}`]);
  rows.push(['Validation', asset.validationStatus]);

  return (
    <Html position={[0, y, 0]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        lineHeight: 1.45,
        color: '#e2e8f0',
        background: 'rgba(2, 6, 23, 0.88)',
        border: '1px solid #334155',
        borderRadius: '6px',
        padding: '8px 10px',
        whiteSpace: 'nowrap',
        transform: 'translateY(-100%)',
      }}>
        <div style={{ fontWeight: 700, color: '#facc15', marginBottom: 4 }}>
          STAGE1 VERIFY · {asset.itemId}
        </div>
        {rows.map(([k, v]) => (
          <div key={k}>
            <span style={{ color: '#64748b' }}>{k}: </span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

/** Real-asset branch: measures the actual runtime file via the shared loader cache. */
function RealAssetVerification({ asset, cardY }: { asset: ModelAsset; cardY: number }) {
  const shared = useLoader(STLLoader, asset.runtimePath!) as THREE.BufferGeometry;
  const measuredM = useMemo<SizeM>(() => {
    const g = normalizeGeometryClone(shared, asset);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const size = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
    g.dispose();
    return size;
  }, [shared, asset]);
  return (
    <group>
      <VerificationGizmos sizeM={measuredM} />
      <InfoCard asset={asset} measuredM={measuredM} y={cardY} />
    </group>
  );
}

/**
 * Overlay for one item in its pose group. `pivotOffsetY` is the same local Y
 * offset used by the rendered mesh (bottom-center compensation), `cardY` the
 * height for the info card (item top + margin, in the same local space).
 */
export function ItemVerificationOverlay({ asset, pivotOffsetY, cardY, fallbackSizeM }: {
  asset: ModelAsset;
  pivotOffsetY: number;
  cardY: number;
  fallbackSizeM: SizeM;
}) {
  return (
    <group position={[0, pivotOffsetY, 0]}>
      {asset.runtimePath ? (
        <RealAssetVerification asset={asset} cardY={cardY} />
      ) : (
        <group>
          <VerificationGizmos sizeM={fallbackSizeM} />
          <InfoCard asset={asset} measuredM={null} y={cardY} />
        </group>
      )}
    </group>
  );
}

export default function RealModelVerification() {
  return null;
}
