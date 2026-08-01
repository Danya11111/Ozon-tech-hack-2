/**
 * SorterDigitalTwinContinuous — 3D scene for continuous playback on main page.
 * Light warehouse-style scene with white-blue palette.
 * 
 * Physical dimensions (1 unit = 1 meter):
 * - Belt top surface: 0.7m from floor
 * - Belt width: 0.5m
 * - Items ride ON the belt surface
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Html, Line, Environment, Lightformer } from '@react-three/drei';
import { Suspense, lazy, useRef, useMemo, useState, useEffect } from 'react';
import type { Mesh, Group } from 'three';
import * as THREE from 'three';
import type { ContinuousPlaybackState, CasePhase } from '../../domain/continuousPlayback';
import { isDetectionActive, isRoutingActive, getPhaseProgress } from '../../domain/continuousPlayback';
import { getPhysicalItemPose, getRoutingStartMs } from '../../domain/physicalItemMotion';
import { shouldShowBoundingBox, shouldShowScanEffect, shouldShowShapeOutline, shouldHighlightCamera } from '../../domain/inspectionViewModel';
import { getMeasurementData, shouldShowLaserBeam, shouldShowStepperPulse, shouldShowPointCloud } from '../../domain/measurementSystem';
import { ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';
import { isCircularCrossSection } from '../../domain/classifier';
import { PhysicalPlaybackItem } from './PhysicalPlaybackItem';
import { PhysicalPlaybackItemPhysics } from './PhysicalPlaybackItemPhysics';
import { RealSenseD435i, RealSenseFrustumDebug, D435I } from './RealSenseD435i';
import {
  ConveyorCadModule,
  CAD_MODULE_ORIGINS,
  CAD_SORTER_WORLD_PIVOTS,
  preloadConveyorCad,
} from './ConveyorCadModel';
import { SorterPhysicsWorld } from './SorterPhysics';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import { GATE_VANE } from '../../domain/pusherMotion';
import { deriveSorterVisualState } from '../../domain/sorterVisualState';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from '../../domain/demoPlaylist';
import { cumulativePlaylistDurationMs, getPlaylistCaseDurationMs } from '../../domain/continuousPlayback';
import { INDUSTRIAL_PALETTE } from '../../domain/industrialTheme';
import { detectQualityMode, getQualitySettings, adaptQuality, type QualityMode } from '../../domain/qualityMode';
import {
  getCameraConfig,
  smoothCameraTransition,
  getInitialCameraConfig,
  type CameraConfig,
  type ViewportType,
} from '../../domain/cinematicCamera';
import {
  BELT_TOP_Y,
  CONVEYOR_WIDTH_M,
  ZONES,
  CAMERA_RIG,
  LASER_HEIGHT_M,
  ROLL_CAGE,
  getRenderedItemDimensions,
  B_RECEIVER,
} from '../../domain/physicalLayout';
import { CHUTE_PITCH, CHUTE_LENGTH, CHUTE_MID_Y, CHUTE_MID_Z, CHUTE_X, CHUTE_HALF_W } from '../../domain/physicsWorldLayout';
import PerfCollector from './PerfCollector';
import PerfOverlay from './PerfOverlay';
import RollCageMesh from './RollCageMesh';
import { getModelAsset } from '../../data/modelAssets';
import { preloadRealItemModelAsync } from './RealItemModel';
import type { Stage0Config } from '../../domain/stage0';
import { shotToPhaseCategory, describeAdaptiveSwitch } from '../../domain/stage0';
import type { Stage1Config } from '../../domain/stage1';

/** Lazy chunk: post-processing spike is downloaded only when stage0 post=1. */
const PostProcessingSpike = lazy(() => import('./PostProcessingSpike'));

export interface SorterDigitalTwinContinuousProps {
  playback: ContinuousPlaybackState;
  simplified?: boolean;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  autoCameraEnabled?: boolean;
  viewportType?: ViewportType;
  qualityMode?: QualityMode;
  stage0?: Stage0Config;
  stage1?: Stage1Config;
  /** ?debug=1 — debug overlays (measurement frustum etc.). */
  debugOverlays?: boolean;
  /** ?debug=1&physics=1 — collider/frustum physics diagnostics. */
  physicsDebug?: boolean;
}

/** 
 * Refined color palette - warehouse aesthetic 
 * Belt: matte PVC/tarpaulin look (blue-gray, not glossy)
 * Frame: industrial metal gray
 * Accents: subtle, not overly bright
 */
const COLORS = {
  background: INDUSTRIAL_PALETTE.background,
  floor: INDUSTRIAL_PALETTE.floor,
  gridCell: INDUSTRIAL_PALETTE.gridCell,
  gridSection: INDUSTRIAL_PALETTE.gridSection,
  conveyorFrame: INDUSTRIAL_PALETTE.frame,
  belt: INDUSTRIAL_PALETTE.belt,
  beltStripe: INDUSTRIAL_PALETTE.beltStripe,
  sideGuards: INDUSTRIAL_PALETTE.metal,
  rollers: INDUSTRIAL_PALETTE.metal,
  supports: INDUSTRIAL_PALETTE.plastic,
  motor: INDUSTRIAL_PALETTE.metalDark,
  sensorAccent: INDUSTRIAL_PALETTE.sensorAccent,
  sensorActive: '#60a5fa',
  gateFrame: INDUSTRIAL_PALETTE.metal,
  routeB: INDUSTRIAL_PALETTE.routeB,
  routeC: INDUSTRIAL_PALETTE.routeC,
  routeD: INDUSTRIAL_PALETTE.routeD,
  itemShadow: '#3a4a5a',
};

const ITEM_MATERIALS: Record<string, { color: string; roughness: number; metalness?: number }> = {
  'SKU-001': { color: '#b68b58', roughness: 0.82 }, // cardboard box
  'SKU-002': { color: '#e8eef6', roughness: 0.5 },  // lunchbox plastic
  'SKU-004': { color: '#c49a6c', roughness: 0.82 }, // oversized cardboard
  'SKU-006': { color: '#f8fafc', roughness: 0.42 }, // ceramic plate
  'SKU-007': { color: '#7dd3fc', roughness: 0.28 }, // bottle plastic
  'SKU-008': { color: '#cbd5e1', roughness: 0.35, metalness: 0.15 }, // cylinder
};

function getItemMaterial(itemId: string) {
  return ITEM_MATERIALS[itemId] ?? { color: '#d8c3a5', roughness: 0.75 };
}

const BELT_Y = BELT_TOP_Y;
/** Max items rendered simultaneously (perf cap). */
const MAX_VISIBLE_ITEMS = 6;
/** Heavy animated overlays off by default for smooth demo. */
const ENABLE_DEMO_EFFECTS = false;

/** Cinematic camera controller - smoothly transitions between camera angles */
/**
 * Debug-only (?debug=1&camera=off&cam=px,py,pz,tx,ty,tz): one-shot camera
 * placement for engineering captures. Ignored without ?debug=1.
 */
function DebugCameraPosition() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('debug') !== '1') return;
    const raw = q.get('cam');
    if (!raw) return;
    const n = raw.split(',').map(Number);
    if (n.length !== 6 || n.some((v) => !Number.isFinite(v))) return;
    camera.position.set(n[0], n[1], n[2]);
    camera.lookAt(n[3], n[4], n[5]);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate]);
  return null;
}

function CinematicCameraController({
  playback,
  enabled,
  viewportType = 'desktop',
  overridePhase = null,
  overrideCategory = null,
}: {
  playback: ContinuousPlaybackState;
  enabled: boolean;
  viewportType: ViewportType;
  /** Manual shot override (stage0) — camera runs even while paused. */
  overridePhase?: CasePhase | null;
  overrideCategory?: Category | null;
}) {
  const { camera } = useThree();
  const cameraStateRef = useRef<CameraConfig>(getInitialCameraConfig(viewportType));
  const isRunning = playback.status === 'running';

  // Get item position for camera following
  const itemPosition = useMemo(() => {
    if (playback.status === 'idle') return null;
    const pose = getPhysicalItemPose({
      caseId: playback.currentCase.id,
      dimensionsMm: { width: 300, depth: 200, height: 200 },
      targetCategory: playback.targetCategory,
      elapsedMs: playback.caseElapsedMs,
      slotIndex: playback.currentCaseIndex,
      faultType: playback.currentCase.faultType,
      jitter: playback.positionJitter,
    });
    return pose.position;
  }, [playback]);

  useFrame(() => {
    if (!enabled) return;
    if (!isRunning && !overridePhase) return;

    // Get target camera config for current phase (or manual shot override)
    const targetConfig = getCameraConfig(
      overridePhase ?? playback.currentPhase,
      overrideCategory ?? playback.targetCategory,
      itemPosition,
      viewportType
    );
    
    // Smooth transition
    cameraStateRef.current = smoothCameraTransition(
      cameraStateRef.current,
      targetConfig,
      0.04 // Smooth factor - lower = smoother
    );
    
    // Apply to camera
    const state = cameraStateRef.current;
    camera.position.set(state.position[0], state.position[1], state.position[2]);
    camera.lookAt(state.target[0], state.target[1], state.target[2]);
    
    // Update FOV if perspective camera
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  });
  
  return null;
}

/** Subtle motion trail behind moving items */
function MotionTrail({ 
  position, 
  visible, 
  color,
  direction 
}: { 
  position: [number, number, number]; 
  visible: boolean;
  color: string;
  direction: 'x' | 'z';
}) {
  if (!visible) return null;
  
  const trailLength = 0.15;
  const offset = direction === 'x' ? [-trailLength, 0, 0] : [0, 0, -trailLength * Math.sign(position[2] || 1)];
  
  return (
    <mesh position={[position[0] + offset[0], position[1], position[2] + offset[2]]}>
      <boxGeometry args={[
        direction === 'x' ? trailLength : 0.08,
        0.02,
        direction === 'z' ? trailLength : 0.08
      ]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={0.3}
      />
    </mesh>
  );
}


/** StepperMotor removed in Stage 2C — CAD motor-and-drive/NEMA17 is the sole drive unit. */

/** Laser beam from rangefinder to item — static opacity, no useFrame. */
function LaserBeam({ active, itemY }: { active: boolean; itemY: number }) {
  if (!active) return null;

  const mount = typeof window !== 'undefined'
    ? (window as unknown as { __CAMERA_PORTAL_MOUNT?: { x: number; y: number; z: number } })
      .__CAMERA_PORTAL_MOUNT
    : null;
  const originX = mount?.x ?? ZONES.CAMERA.x;
  const originY = mount ? mount.y - D435I.height : LASER_HEIGHT_M;
  const beamLength = Math.max(0.05, originY - itemY);
  const beamCenterY = itemY + beamLength / 2;

  return (
    <group position={[originX, 0, 0]}>
      <mesh position={[0, beamCenterY, 0]}>
        <cylinderGeometry args={[0.0025, 0.0025, beamLength, 8]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.55}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Scan spot on item */}
      <mesh position={[0, itemY + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.012, 16]} />
        <meshStandardMaterial 
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Laser emitter */}
      <mesh position={[0, LASER_HEIGHT_M, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
        <meshStandardMaterial 
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={active ? 0.4 : 0}
        />
      </mesh>
    </group>
  );
}

/** Point cloud dots around item during stereo analysis */
function PointCloud({ active, itemPosition, scale, isRound }: { 
  active: boolean; 
  itemPosition: [number, number, number];
  scale: number;
  isRound: boolean;
}) {
  if (!active) return null;
  
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const count = 12;
    const radius = scale * 0.4;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = isRound ? radius : radius * (1 + Math.cos(angle * 2) * 0.3);
      pts.push([
        Math.cos(angle) * r,
        0,
        Math.sin(angle) * r,
      ]);
    }
    return pts;
  }, [scale, isRound]);
  
  return (
    <group position={[itemPosition[0], itemPosition[1] + scale * 0.3, itemPosition[2]]}>
      {points.map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial 
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * CAD-style 20×20 aluminum-extrusion legs under the three modules.
 * Stations at module joints / ends — skip mid-sorter so gates stay readable.
 */
function CadStyleSupportLegs({ shadows = false }: { shadows?: boolean }) {
  const frameUndersideY = 0.50;
  const footY = 0.015;
  const legH = frameUndersideY - footY;
  const tube = 0.022;
  const zSide = 0.255;
  /** World X stations: module starts/joints + sorter exit (not mid-gate). */
  const stations = [-4.02, -3.015, -2.01, -1.005, 0.0, 2.01];
  const color = '#7d8b99';

  return (
    <group name="cad-style-supports">
      {stations.map((x) =>
        ([-1, 1] as const).map((side) => {
          const z = side * zSide;
          return (
            <group key={`${x}:${side}`} position={[x, 0, z]}>
              <mesh position={[0, footY + legH / 2, 0]} castShadow={shadows}>
                <boxGeometry args={[tube, legH, tube]} />
                <meshStandardMaterial color={color} metalness={0.55} roughness={0.45} />
              </mesh>
              <mesh position={[0, footY, 0]}>
                <boxGeometry args={[0.06, 0.012, 0.06]} />
                <meshStandardMaterial color="#5c6772" metalness={0.4} roughness={0.55} />
              </mesh>
              <mesh position={[0, frameUndersideY - 0.01, 0]}>
                <boxGeometry args={[0.045, 0.02, 0.045]} />
                <meshStandardMaterial color={color} metalness={0.55} roughness={0.45} />
              </mesh>
            </group>
          );
        }),
      )}
      {/* Light cross-braces at mid clean / camera only */}
      {[-3.015, -1.005].map((x) => (
        <mesh key={`brace-${x}`} position={[x, 0.18, 0]}>
          <boxGeometry args={[tube * 0.85, tube * 0.85, zSide * 2]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Product line: three sequential CAD modules only.
 *  1 clean conveyor · 2 conveyor+camera · 3 conveyor+sorter
 * No procedural belt extensions, end cylinders, or side-guard clutter.
 */
function ConveyorBelt({
  pulseActive: _pulseActive,
  elapsedMs: _elapsedMs,
  simplified: _simplified,
  shadows = false,
  gateOpen: _gateOpen = false,
  beltVelocityMps = 0,
  rollerOmega = 0,
  sorterCategory = null,
  caseElapsedMs = 0,
  productId = null,
  itemWorldX = null,
  itemHalfLengthS = 0.15,
  playbackPaused = false,
  playbackResetEpoch = 0,
}: {
  pulseActive: boolean;
  elapsedMs: number;
  simplified: boolean;
  shadows?: boolean;
  gateOpen?: boolean;
  beltVelocityMps?: number;
  rollerOmega?: number;
  sorterCategory?: Category | null;
  caseElapsedMs?: number;
  productId?: string | null;
  itemWorldX?: number | null;
  itemHalfLengthS?: number;
  playbackPaused?: boolean;
  playbackResetEpoch?: number;
}) {
  void _pulseActive;
  void _elapsedMs;
  void _simplified;
  void _gateOpen;

  return (
    <group name="SorterCadAssembly" userData={{ role: 'three-cad-modules' }}>
      <Suspense fallback={null}>
        <ConveyorCadModule
          variant="clean"
          originX={CAD_MODULE_ORIGINS.clean}
          shadows={shadows}
          rollerOmegaRadPerSec={rollerOmega}
          beltVelocityMps={beltVelocityMps}
          playbackPaused={playbackPaused}
        />
        <ConveyorCadModule
          variant="camera"
          originX={CAD_MODULE_ORIGINS.camera}
          shadows={shadows}
          rollerOmegaRadPerSec={rollerOmega}
          beltVelocityMps={beltVelocityMps}
          playbackPaused={playbackPaused}
        />
        <ConveyorCadModule
          variant="sorter"
          originX={CAD_MODULE_ORIGINS.sorter}
          shadows={shadows}
          rollerOmegaRadPerSec={rollerOmega}
          beltVelocityMps={beltVelocityMps}
          sorterCategory={sorterCategory}
          caseElapsedMs={caseElapsedMs}
          productId={productId}
          itemWorldX={itemWorldX}
          itemHalfLengthS={itemHalfLengthS}
          playbackPaused={playbackPaused}
          playbackResetEpoch={playbackResetEpoch}
        />
      </Suspense>
      <CadStyleSupportLegs shadows={shadows} />
    </group>
  );
}

/** Zone marker for A and B (simple floor marker) */
function ZoneMarker({ position, label, color, active }: {
  position: [number, number, number];
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={active ? 0.35 : 0.12}
        />
      </mesh>
      <Html position={[0, 0.15, 0]} center>
        <div style={{
          color: active ? color : '#64748b',
          fontSize: '20px',
          fontWeight: 800,
          textShadow: active ? `0 0 8px ${color}` : 'none',
          userSelect: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/**
 * B receiving bin — отдельный промышленный контейнер на полу (не продолжение ленты).
 * Короткий transfer spur + drop chute в открытый bin 1.2×0.8 m.
 */
/** Compact B bin — close to sorter module, no green spur/chute clutter. */
function BReceiverBin({ active }: { active: boolean }) {
  const { centerX, centerZ, width, depth, wallHeight, floorY } = B_RECEIVER;
  const emissive = active ? 0.22 : 0.03;
  const hx = width / 2;
  const hz = depth / 2;
  const wall = 0.03;
  const entryX = centerX - hx + 0.08;
  const metal = '#4a5560';

  return (
    <group>
      <mesh position={[centerX, floorY - 0.01, centerZ]}>
        <boxGeometry args={[width - 0.05, 0.025, depth - 0.05]} />
        <meshStandardMaterial color="#2c333c" roughness={0.85} metalness={0.15} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[centerX, floorY + wallHeight / 2, centerZ + s * hz]}>
          <boxGeometry args={[width, wallHeight, wall]} />
          <meshStandardMaterial color={metal} roughness={0.65} metalness={0.35} emissive={COLORS.routeB} emissiveIntensity={emissive} />
        </mesh>
      ))}
      <mesh position={[centerX + hx, floorY + wallHeight / 2, centerZ]}>
        <boxGeometry args={[wall, wallHeight, depth]} />
        <meshStandardMaterial color={metal} roughness={0.65} metalness={0.35} emissive={COLORS.routeB} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[entryX, floorY + wallHeight / 5, centerZ]}>
        <boxGeometry args={[wall, wallHeight / 2.5, depth - 0.08]} />
        <meshStandardMaterial color={metal} roughness={0.65} metalness={0.35} />
      </mesh>
      <Html position={[centerX, floorY + wallHeight + 0.18, centerZ]} center>
        <div style={{ color: active ? COLORS.routeB : '#64748b', fontSize: '20px', fontWeight: 800, userSelect: 'none' }}>B</div>
      </Html>
    </group>
  );
}

/** Roll cage for C/D zones — shared instanced mesh (exterior 1200×800×800 incl. wheels) */
function RollCage({ position, label, color, active, shadows = false }: {
  position: [number, number, number];
  label: 'C' | 'D';
  color: string;
  active: boolean;
  shadows?: boolean;
}) {
  const { width, depth, height } = ROLL_CAGE;

  return (
    <group position={position}>
      {/* Floor marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[width + 0.2, depth + 0.2]} />
        <meshStandardMaterial color={color} transparent opacity={active ? 0.25 : 0.08} />
      </mesh>

      <RollCageMesh color={color} active={active} shadows={shadows} openSide={label === 'C' ? 'z-' : 'z+'} />

      {/* Label */}
      <Html position={[0, height + 0.15, 0]} center>
        <div style={{
          color: active ? color : '#64748b',
          fontSize: '18px',
          fontWeight: 800,
          textShadow: active ? `0 0 8px ${color}` : 'none',
          userSelect: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}


/** Chute/deflector for routing items to C/D.
 *  Visual geometry matches the physics collider and the domain kinematic
 *  chute line: steep gravity chute (~0.394 rad) from belt edge (y 0.66)
 *  down to the open cage front (y 0.14) — see domain/physicsWorldLayout. */
/** Minimal muted transfer into close-in cages (no neon green blocks). */
function RouteChute({ gateX, targetZ, color, active }: {
  gateX: number;
  targetZ: number;
  color: string;
  active: boolean;
}) {
  const chuteWidth = CHUTE_HALF_W * 2;
  const direction = targetZ > 0 ? 1 : -1;
  const midZ = direction * CHUTE_MID_Z;
  const rot: [number, number, number] = [direction * CHUTE_PITCH, 0, 0];
  void gateX;

  return (
    <group>
      <mesh position={[CHUTE_X, CHUTE_MID_Y - 0.01, midZ]} rotation={rot}>
        <boxGeometry args={[chuteWidth, 0.018, CHUTE_LENGTH]} />
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.45}
          roughness={0.5}
          emissive={color}
          emissiveIntensity={active ? 0.12 : 0}
        />
      </mesh>
    </group>
  );
}

/**
 * Single RealSense body mounted under the CAD portal cross-beam.
 * Procedural floating laser housing removed (was a second "camera" body).
 */
function CameraRig({ active }: { active: boolean }) {
  const groupRef = useRef<Group>(null);
  useEffect(() => {
    const apply = () => {
      const mount = (window as unknown as {
        __CAMERA_PORTAL_MOUNT?: { x: number; y: number; z: number };
      }).__CAMERA_PORTAL_MOUNT;
      const g = groupRef.current;
      if (!g) return;
      if (mount) {
        // Bind under portal beam — sensor hangs from CAD mount (AUTHOR portal).
        g.position.set(mount.x, mount.y - D435I.height / 2, mount.z);
      } else {
        // Fallback until CAD camera module publishes mount.
        g.position.set(ZONES.CAMERA.x, CAMERA_RIG.cameraY, 0);
      }
    };
    apply();
    const id = window.setInterval(apply, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const runtime = {
      NODE: 'RealSenseD435i',
      PARENT: 'CameraRig → CAD portal mount',
      SOURCE: 'RealSenseD435i.tsx',
      AUTHOR_CAD_OR_RUNTIME: 'RUNTIME',
      VISIBLE: true,
      WORLD_POSITION: 'bound to __CAMERA_PORTAL_MOUNT',
      FUNCTION: 'depth camera sensor body',
      KEEP_OR_HIDE: 'KEEP',
    };
    const hidden = {
      NODE: 'procedural-laser-housing',
      PARENT: 'CameraRig',
      SOURCE: 'SorterDigitalTwinContinuous (removed)',
      AUTHOR_CAD_OR_RUNTIME: 'RUNTIME',
      VISIBLE: false,
      WORLD_POSITION: [ZONES.CAMERA.x + 0.12, LASER_HEIGHT_M, 0],
      FUNCTION: 'legacy floating secondary camera body',
      KEEP_OR_HIDE: 'HIDE',
    };
  }, []);

  return (
    <group ref={groupRef} name="camera-sensor-assembly">
      <RealSenseD435i />
      <mesh position={[D435I.depth / 2 + 0.002, 0.004, 0]}>
        <boxGeometry args={[0.002, 0.004, 0.006]} />
        <meshStandardMaterial
          color={active ? '#22c55e' : '#14532d'}
          emissive={active ? '#22c55e' : '#000'}
          emissiveIntensity={active ? 1.2 : 0}
        />
      </mesh>
    </group>
  );
}

/** Inspection zone on belt - at belt surface height */
function InspectionZone({ active }: { active: boolean }) {
  return (
    <group position={[ZONES.CAMERA.x, BELT_Y + 0.005, 0]}>
      {/* Inspection area rectangle on belt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, CONVEYOR_WIDTH_M - 0.05]} />
        <meshStandardMaterial 
          color={active ? COLORS.sensorActive : '#94a3b8'}
          transparent 
          opacity={active ? 0.2 : 0.05}
        />
      </mesh>
      {/* Corner markers */}
      {[[-0.3, (CONVEYOR_WIDTH_M - 0.1) / 2], [0.3, (CONVEYOR_WIDTH_M - 0.1) / 2], 
        [-0.3, -(CONVEYOR_WIDTH_M - 0.1) / 2], [0.3, -(CONVEYOR_WIDTH_M - 0.1) / 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.025, 0.04, 4]} />
          <meshStandardMaterial 
            color={active ? COLORS.sensorActive : '#64748b'}
            transparent 
            opacity={active ? 0.8 : 0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Animated scan line - sweeps across belt at surface height */
function ScanLine({ active }: { active: boolean }) {
  const lineRef = useRef<Mesh>(null);
  const halfWidth = (CONVEYOR_WIDTH_M - 0.08) / 2;
  const posRef = useRef(halfWidth);
  const dirRef = useRef(-1);
  
  useFrame((_, delta) => {
    if (lineRef.current && active) {
      posRef.current += dirRef.current * delta * 0.6;
      if (posRef.current < -halfWidth) {
        posRef.current = -halfWidth;
        dirRef.current = 1;
      }
      if (posRef.current > halfWidth) {
        posRef.current = halfWidth;
        dirRef.current = -1;
      }
      lineRef.current.position.z = posRef.current;
    }
  });

  if (!active) return null;

  return (
    <mesh ref={lineRef} position={[ZONES.CAMERA.x, BELT_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.65, 0.015]} />
      <meshStandardMaterial 
        color="#22d3ee" 
        emissive="#22d3ee"
        emissiveIntensity={0.6}
        transparent 
        opacity={0.8}
      />
    </mesh>
  );
}

/** Bounding box wireframe around item */
function BoundingBoxVisual({ position, scale, visible, isRound }: {
  position: [number, number, number];
  scale: number;
  visible: boolean;
  isRound: boolean;
}) {
  if (!visible) return null;
  
  const w = scale * 0.5;
  const h = scale * 0.4;
  const d = scale * 0.5;
  
  const corners = [
    [-w, -h, -d], [w, -h, -d], [w, -h, d], [-w, -h, d],
    [-w, h, -d], [w, h, -d], [w, h, d], [-w, h, d],
  ];
  
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return (
    <group position={position}>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          points={[corners[a] as [number, number, number], corners[b] as [number, number, number]]}
          color={COLORS.sensorActive}
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}
      {/* Dimension lines - subtle */}
      <Line
        points={[[-w - 0.05, 0, d + 0.05], [w + 0.05, 0, d + 0.05]]}
        color="#64748b"
        lineWidth={1}
        dashed
        dashSize={0.02}
        gapSize={0.02}
      />
      <Line
        points={[[w + 0.05, -h, -d - 0.05], [w + 0.05, h, -d - 0.05]]}
        color="#64748b"
        lineWidth={1}
        dashed
        dashSize={0.02}
        gapSize={0.02}
      />
    </group>
  );
}

/** Shape outline - circle for round, square for box */
function ShapeOutline({ position, scale, visible, isRound, category }: {
  position: [number, number, number];
  scale: number;
  visible: boolean;
  isRound: boolean;
  category: Category | null;
}) {
  if (!visible) return null;
  
  const color = category === 'B' ? COLORS.routeB 
    : category === 'C' ? COLORS.routeC 
    : category === 'D' ? COLORS.routeD 
    : COLORS.sensorActive;

  return (
    <group position={[position[0], position[1] + scale * 0.5, position[2]]}>
      {isRound ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[scale * 0.4, scale * 0.45, 32]} />
          <meshStandardMaterial 
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            transparent 
            opacity={0.7}
          />
        </mesh>
      ) : (
        <>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z], i, arr) => {
            const next = arr[(i + 1) % 4];
            return (
              <Line
                key={i}
                points={[
                  [x * scale * 0.35, 0, z * scale * 0.35],
                  [next[0] * scale * 0.35, 0, next[1] * scale * 0.35],
                ]}
                color={color}
                lineWidth={2}
              />
            );
          })}
        </>
      )}
    </group>
  );
}

/**
 * Kinematic colliders locked to CAD swing diverters (Барьер001/002).
 * Downstream hinge fixed; free end along −X at 0°, arcs with the same yaw.
 */
function CadGateColliders({
  category,
  caseElapsedMs,
}: {
  category: Category | null;
  caseElapsedMs: number;
}) {
  const leftRef = useRef<RapierRigidBody>(null);
  const rightRef = useRef<RapierRigidBody>(null);
  const [hx, hy, hz] = GATE_VANE.halfExtents;
  void category;
  void caseElapsedMs;

  useFrame(() => {
    // Sync existing CAD gate colliders to visual diverter angles (no new physics).
    const motions = typeof window !== 'undefined'
      ? (window as unknown as {
          __DIVERTER_MOTIONS?: { leftRad: number; rightRad: number };
        }).__DIVERTER_MOTIONS
      : undefined;
    const leftYaw = motions?.leftRad ?? 0;
    const rightYaw = motions?.rightRad ?? 0;
    const apply = (
      body: RapierRigidBody | null,
      pivot: { x: number; y: number; z: number },
      yaw: number,
    ) => {
      if (!body) return;
      const x = pivot.x - Math.cos(yaw) * hx;
      const z = pivot.z + Math.sin(yaw) * hx;
      body.setNextKinematicTranslation({ x, y: GATE_VANE.centerY, z });
      const half = yaw / 2;
      body.setNextKinematicRotation({
        x: 0, y: Math.sin(half), z: 0, w: Math.cos(half),
      });
    };
    apply(leftRef.current, CAD_SORTER_WORLD_PIVOTS.left, leftYaw);
    apply(rightRef.current, CAD_SORTER_WORLD_PIVOTS.right, rightYaw);
  });

  const lp = CAD_SORTER_WORLD_PIVOTS.left;
  const rp = CAD_SORTER_WORLD_PIVOTS.right;
  return (
    <group name="cad-gate-colliders">
      <RigidBody ref={leftRef} type="kinematicPosition" colliders={false} friction={0.55}
        position={[lp.x - hx, GATE_VANE.centerY, lp.z]}>
        <CuboidCollider args={[hx, hy, hz]} friction={0.55} restitution={0} />
      </RigidBody>
      <RigidBody ref={rightRef} type="kinematicPosition" colliders={false} friction={0.55}
        position={[rp.x - hx, GATE_VANE.centerY, rp.z]}>
        <CuboidCollider args={[hx, hy, hz]} friction={0.55} restitution={0} />
      </RigidBody>
    </group>
  );
}

/** Junction status mark on the belt only. */
function GateZone({ category }: { category: Category | null; shadows?: boolean }) {
  const gateColor = category === 'B' ? COLORS.routeB
    : category === 'C' ? COLORS.routeC
    : category === 'D' ? COLORS.routeD
    : COLORS.gateFrame;

  return (
    <group position={[ZONES.GATE.x, 0, 0]}>
      <mesh position={[0, BELT_Y + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, CONVEYOR_WIDTH_M - 0.05]} />
        <meshStandardMaterial
          color={gateColor}
          transparent
          opacity={category ? 0.28 : 0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Main continuous scene - light warehouse style with correct physical dimensions */
function ContinuousScene({
  playback,
  simplified,
  autoCameraEnabled,
  viewportType,
  stage0,
  stage1,
  maxVisibleItems = MAX_VISIBLE_ITEMS,
  shadowsEnabled = false,
  debugOverlays = false,
  physicsDebug = false,
}: {
  playback: ContinuousPlaybackState;
  simplified: boolean;
  autoCameraEnabled: boolean;
  viewportType: ViewportType;
  stage0?: Stage0Config;
  stage1?: Stage1Config;
  maxVisibleItems?: number;
  /** Stage 2 visual pass: PCF shadows + studio environment on capable quality modes. */
  shadowsEnabled?: boolean;
  debugOverlays?: boolean;
  physicsDebug?: boolean;
}) {
  const category = playback.targetCategory;
  const phase = playback.currentPhase;
  const liteScene = simplified || !ENABLE_DEMO_EFFECTS;
  const effectsEnabled = ENABLE_DEMO_EFFECTS && !simplified;

  // Stage 0 prototype flags (inert when stage0 is absent — default route unchanged)
  const proto = stage0?.enabled ?? false;
  const protoShadows = proto ? (proto && stage0!.shadows) : shadowsEnabled;
  const protoCamera = proto && stage0!.camera;
  const shotOverride = protoCamera && stage0!.shot ? shotToPhaseCategory(stage0!.shot) : null;
  // Stage 2: premium industrial dark environment is the default look.
  const darkBg = proto ? stage0!.darkBackground : true;
  
  const cameraHighlight = shouldHighlightCamera(phase);
  const showScan = shouldShowScanEffect(phase);
  
  // Stage 2: single domain -> visual/physics adapter (business logic stays truth)
  const visualState = deriveSorterVisualState(playback);

  // Measurement system states
  const measurementData = getMeasurementData(playback);
  const showLaser = shouldShowLaserBeam(phase);
  const showPulse = shouldShowStepperPulse(phase);
  const showCloud = shouldShowPointCloud(phase);
  
  // Compute physical items based on elapsed time. Cap the number of
  // simultaneously rendered items to keep the scene lightweight.
  // Use cumulative playlist durations (cases may differ: jam / e-stop).
  const { totalElapsedMs, currentCase, currentCaseIndex, caseElapsedMs, positionJitter } = playback;
  const casesSpawned = currentCaseIndex + 1;
  const startIndex = Math.max(0, casesSpawned - maxVisibleItems);

  const sceneItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i < casesSpawned; i++) {
      const playlistIndex = i % PLAYLIST_LENGTH;
      const caseData = DEMO_PLAYLIST[playlistIndex];
      const caseStart = cumulativePlaylistDurationMs(i);
      const elapsedMs = i === currentCaseIndex
        ? caseElapsedMs
        : getPlaylistCaseDurationMs(caseData) + 1; // settled past end for prior cases
      items.push({
        id: `item-${i}-${caseData.id}`,
        slotIndex: i,
        caseData,
        elapsedMs: Math.max(0, elapsedMs),
        caseStart,
      });
    }
    return items;
  }, [caseElapsedMs, casesSpawned, startIndex, currentCaseIndex]);

  // Get item data for the current case
  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
  const isRound = isCircularCrossSection(itemData.roundness);
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);

  // Stage 1 real-model verification overlay (debug only, read-only)
  const verifySku = stage1?.enabled && stage1.verify === 'real-models'
    ? (stage1.sku ?? itemId)
    : null;

  // Preload ALL playlist runtime assets before first spawn (atomic readiness).
  const [productAssetsReady, setProductAssetsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const urls = new Set<string>();
    for (const c of DEMO_PLAYLIST) {
      const id = c.itemId.replace('-LC', '');
      const asset = getModelAsset(id);
      if (asset?.runtimePath) urls.add(asset.runtimePath);
    }
    preloadConveyorCad();
    Promise.all([...urls].map((u) => preloadRealItemModelAsync(u)))
      .then(() => {
        if (cancelled) return;
        setProductAssetsReady(true);
        const w = window as unknown as {
          __PRODUCT_ASSETS_READY?: boolean;
          __PRODUCT_LIFECYCLE?: unknown;
        };
        w.__PRODUCT_ASSETS_READY = true;
        w.__PRODUCT_LIFECYCLE = {
          visualReadyBeforeSpawn: true,
          physicsReadyBeforeSpawn: true,
          spawnTransformAppliedOnce: true,
          duplicateProductInstances: 0,
          fallbackReplacementUsed: false,
          staleRigidBodies: false,
        };
        window.dispatchEvent(new Event('product-assets-ready'));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[PRODUCT_ASSETS] preload failed, allowing procedural spawn', err);
        if (!cancelled) {
          setProductAssetsReady(true);
          (window as unknown as { __PRODUCT_ASSETS_READY?: boolean }).__PRODUCT_ASSETS_READY = true;
        }
      });
    return () => { cancelled = true; };
  }, []);
  const itemScale = Math.max(dims.width, dims.depth, dims.height);
  
  // Get item position for measurement visualization using physical model
  const currentItemElapsed = caseElapsedMs;
  const currentPose = getPhysicalItemPose({
    caseId: currentCase.id,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: category,
    elapsedMs: currentItemElapsed,
    slotIndex: currentCaseIndex,
    faultType: currentCase.faultType,
    jitter: positionJitter,
  });
  const itemPos = currentPose.position;
  const activeRoute = currentPose.activeRoute;

  // Debug timing capture: optional forced product S for proof screenshots.
  const forceProd = typeof window !== 'undefined'
    ? (window as unknown as {
        __DIVERTER_PRODUCT_INPUT?: { itemCenterS?: number };
      }).__DIVERTER_PRODUCT_INPUT
    : undefined;
  const displayItemPos: [number, number, number] = (
    typeof forceProd?.itemCenterS === 'number'
      ? [forceProd.itemCenterS, itemPos[1], itemPos[2]]
      : itemPos
  );

  // Reset diverter product machine on stop / restart.
  const resetEpochRef = useRef(0);
  const prevStatusRef = useRef(playback.status);
  if (
    prevStatusRef.current !== 'idle'
    && playback.status === 'idle'
  ) {
    resetEpochRef.current += 1;
  }
  prevStatusRef.current = playback.status;
  const playbackResetEpoch = resetEpochRef.current;
  const itemHalfLengthS = dims.width / 2;
  
  // Motion trail visibility - show during movement phases
  const showMotionTrail = ['move_to_detection', 'routing', 'exit'].includes(phase) && 
                          playback.status === 'running';
  const trailDirection = phase === 'routing' || phase === 'exit' 
    ? (activeRoute === 'C' || activeRoute === 'D' ? 'z' : 'x') 
    : 'x';
  const itemColor = category ? COLORS[`route${category}` as keyof typeof COLORS] : COLORS.sensorAccent;
  
  // Stage 2: cinematic auto-camera is the default presentation (§13.5 —
  // OrbitControls remain only as the manual/debug mode when auto cam is off).
  const cinematicActive = autoCameraEnabled
    && (playback.status === 'running' || shotOverride !== null);

  return (
    <>
      {/* Background: industrial dark product canvas (equipment must dominate) */}
      <color attach="background" args={[darkBg ? INDUSTRIAL_PALETTE.backgroundDark : '#070d16']} />
      <fog attach="fog" args={[darkBg ? INDUSTRIAL_PALETTE.backgroundDark : '#070d16', 13, 26]} />

      {proto ? (
        <>
          {/* Cinematic rig: very low ambient, strong key, soft fill, cool rim */}
          <ambientLight intensity={stage0!.ambient} />
          <hemisphereLight args={['#223148', '#0b1220', 0.3]} />
          <directionalLight
            position={[6, 9, 4]}
            intensity={1.6}
            castShadow={protoShadows}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={7}
            shadow-camera-bottom={-7}
            shadow-camera-near={1}
            shadow-camera-far={25}
            shadow-bias={-0.0004}
          />
          {/* Fill — keeps shadowed side readable */}
          {stage0!.fill && <directionalLight position={[-5, 6, -3]} intensity={0.35} />}
          {/* Rim — cheap back light for edge separation */}
          {stage0!.rim && <directionalLight position={[2, 5, -8]} intensity={0.7} color="#bcd7ff" />}
        </>
      ) : (
        <>
          {/* Stage 2 default: premium industrial rig — readable ambient, key with
              PCF shadows, soft fill, cool rim (Stage 0 proven values, brightened
              in 2B so brackets/rollers read as volumes from every angle) */}
          <ambientLight intensity={0.46} />
          <hemisphereLight args={['#314860', '#0a1018', 0.9]} />
          <directionalLight
            position={[6, 9, 4]}
            intensity={2.7}
            castShadow={shadowsEnabled}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={7}
            shadow-camera-bottom={-7}
            shadow-camera-near={1}
            shadow-camera-far={25}
            shadow-bias={-0.00035}
            shadow-normalBias={0.025}
          />
          <directionalLight position={[-5, 6, -3]} intensity={0.7} />
          <directionalLight position={[2, 5, -8]} intensity={0.85} color="#bcd7ff" />
          {/* low front fill so the +Z face (camera side) never goes black */}
          <directionalLight position={[1, 3, 8]} intensity={0.55} color="#cfdcf2" />
          {/* Procedural studio environment (no external HDRI — offline-safe) */}
          {shadowsEnabled && (
            <Environment resolution={64} frames={1}>
              <Lightformer intensity={1.6} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#dfe9ff" />
              <Lightformer intensity={0.7} position={[-5, 2, -4]} rotation-y={Math.PI / 3} scale={[4, 2, 1]} color="#b8c8e8" />
              <Lightformer intensity={0.5} position={[5, 1.5, 3]} rotation-y={-Math.PI / 4} scale={[3, 1.5, 1]} color="#ffe9c8" />
            </Environment>
          )}
        </>
      )}

      {/* Grid — subdued so equipment remains the visual subject */}
      <Grid
        args={[16, 12]}
        cellSize={0.5}
        cellThickness={0.22}
        cellColor={darkBg ? '#1a2533' : '#1e2a38'}
        sectionSize={2}
        sectionThickness={0.45}
        sectionColor={darkBg ? '#243344' : '#2a3a4c'}
        fadeDistance={10}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Floor — dark polished concrete with soft reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={shadowsEnabled}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial
          color={darkBg ? '#121a26' : '#151d2a'}
          roughness={darkBg ? 0.64 : 0.8}
          metalness={darkBg ? 0.2 : 0.1}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Three CAD modules: clean → camera → sorter */}
      <ConveyorBelt
        pulseActive={showPulse}
        elapsedMs={totalElapsedMs}
        simplified={liteScene}
        shadows={shadowsEnabled}
        gateOpen={visualState.gateOpen}
        beltVelocityMps={visualState.beltVelocityMps}
        rollerOmega={visualState.rollerOmegaRadPerSec}
        sorterCategory={category}
        caseElapsedMs={caseElapsedMs}
        productId={currentCase.id}
        itemWorldX={displayItemPos[0]}
        itemHalfLengthS={itemHalfLengthS}
        playbackPaused={playback.status !== 'running'}
        playbackResetEpoch={playbackResetEpoch}
      />

      <ZoneMarker
        position={[ZONES.A.x, 0.01, ZONES.A.z]}
        label="A"
        color={COLORS.sensorAccent}
        active={playback.currentPhase === 'spawn'}
      />

      <BReceiverBin active={activeRoute === 'B'} />
      <RollCage
        position={[ZONES.C.x, 0, ZONES.C.z]}
        label="C"
        color={COLORS.routeC}
        active={activeRoute === 'C'}
        shadows={shadowsEnabled}
      />
      <RollCage
        position={[ZONES.D.x, 0, ZONES.D.z]}
        label="D"
        color={COLORS.routeD}
        active={activeRoute === 'D'}
        shadows={shadowsEnabled}
      />

      <RouteChute
        gateX={ZONES.GATE.x}
        targetZ={ZONES.C.z}
        color={COLORS.routeC}
        active={activeRoute === 'C'}
      />
      <RouteChute
        gateX={ZONES.GATE.x}
        targetZ={ZONES.D.z}
        color={COLORS.routeD}
        active={activeRoute === 'D'}
      />

      {/* RealSense on camera module (CAD portal is in ConveyorCadModule) */}
      <CameraRig active={cameraHighlight} />
      {(physicsDebug || debugOverlays) && <RealSenseFrustumDebug />}

      <LaserBeam active={showLaser} itemY={itemPos[1]} />
      {effectsEnabled && (
        <PointCloud
          active={showCloud}
          itemPosition={itemPos}
          scale={itemScale}
          isRound={isRound}
        />
      )}
      <InspectionZone active={cameraHighlight} />
      {effectsEnabled && <ScanLine active={showScan} />}
      <GateZone category={category} shadows={protoShadows} />

      {/* CAD sorter gates (visual) + matching kinematic colliders */}
      <SorterPhysicsWorld running={playback.status === 'running'} speed={playback.speed}>
        <CadGateColliders category={category} caseElapsedMs={caseElapsedMs} />
        {productAssetsReady && sceneItems.map(item => (
          <PhysicalPlaybackItemPhysics
            key={item.id}
            caseData={item.caseData}
            elapsedMs={item.elapsedMs}
            slotIndex={item.slotIndex}
            verifySku={verifySku}
            jitter={item.slotIndex === currentCaseIndex ? positionJitter : undefined}
            castShadow={shadowsEnabled}
          />
        ))}
      </SorterPhysicsWorld>
      
      {/* Outline/BBox for the CURRENT item only */}
      <BoundingBoxVisual 
        position={displayItemPos} 
        scale={itemScale} 
        visible={shouldShowBoundingBox(phase) || typeof forceProd?.itemCenterS === 'number'} 
        isRound={isRound}
      />
      <ShapeOutline 
        position={displayItemPos} 
        scale={itemScale} 
        visible={shouldShowShapeOutline(phase) || typeof forceProd?.itemCenterS === 'number'} 
        isRound={isRound}
        category={category}
      />
      
      {/* Motion trail — opt-in only */}
      {effectsEnabled && (
        <MotionTrail
          position={itemPos}
          visible={showMotionTrail}
          color={itemColor}
          direction={trailDirection as 'x' | 'z'}
        />
      )}

      {/* Cinematic camera controller — default on; manual orbit = debug mode */}
      <CinematicCameraController
        playback={playback}
        enabled={cinematicActive}
        viewportType={viewportType}
        overridePhase={shotOverride?.phase ?? null}
        overrideCategory={shotOverride?.category ?? null}
      />

      {!cinematicActive && <DebugCameraPosition />}

      {/* OrbitControls - enabled when not in cinematic mode */}
      <OrbitControls
        enablePan={!simplified && !cinematicActive}
        enableZoom={!cinematicActive}
        enableRotate={!cinematicActive}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={14}
        target={[0, BELT_Y, 0]}
        autoRotate={false}
      />
    </>
  );
}

/**
 * Stage 0 adaptive quality: rolling-average FPS, checks at most once per 4 s,
 * cooldown between switches, max 3 automatic steps. Only the DPR lever is
 * applied live (via R3F setDpr — no React state churn per frame); shadow/AA
 * changes require remount and are reported as not-live-switchable.
 */
function AdaptiveQualityController({ initialMode }: { initialMode: QualityMode }) {
  const setDpr = useThree((s) => s.setDpr);
  const stateRef = useRef({
    mode: initialMode as QualityMode,
    frames: 0,
    windowStart: 0,
    lastSwitchAt: 0,
    switches: 0,
  });

  useFrame(({ clock }) => {
    const st = stateRef.current;
    st.frames += 1;
    const now = clock.elapsedTime;
    if (st.windowStart === 0) {
      st.windowStart = now;
      st.lastSwitchAt = now;
      return;
    }
    const windowLen = now - st.windowStart;
    if (windowLen < 4) return; // evaluate at most once per 4 s

    const avgFps = st.frames / windowLen;
    st.frames = 0;
    st.windowStart = now;

    const previous = st.mode;
    const next = adaptQuality(previous, avgFps);
    if (next === previous) return;
    if (st.switches >= 3) return; // cap automatic switches
    if (now - st.lastSwitchAt < 8) return; // cooldown / hysteresis

    st.mode = next;
    st.switches += 1;
    st.lastSwitchAt = now;
    setDpr(Math.min(window.devicePixelRatio || 1, getQualitySettings(next).dprMax));
    if (typeof window !== 'undefined') {
      const message = describeAdaptiveSwitch(previous, next, avgFps);
      console.info(`[stage0] ${message}`);
      const w = window as unknown as { __STAGE0_ADAPT__?: string[] };
      w.__STAGE0_ADAPT__ ??= [];
      w.__STAGE0_ADAPT__.push(message);
    }
  });

  return null;
}

export default function SorterDigitalTwinContinuous({
  playback,
  simplified = false,
  onContextLost,
  onContextRestored,
  autoCameraEnabled = true,
  viewportType = 'desktop',
  qualityMode,
  stage0,
  stage1,
  debugOverlays = false,
  physicsDebug = false,
}: SorterDigitalTwinContinuousProps) {
  const mode = qualityMode ?? detectQualityMode(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const quality = getQualitySettings(mode);
  const useSimplified = simplified || mode === 'low';
  const antialias = quality.antialias && !useSimplified;
  const proto = stage0?.enabled ?? false;
  const protoShadows = proto && stage0!.shadows;
  const shadowsEnabled = proto ? protoShadows : quality.shadows;
  const perfEnabled =
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('perf') === '1') ||
    (proto && stage0!.perf);
  return (
    <div className="digital-twin-wrap continuous-twin">
      <div className="digital-twin-canvas continuous-canvas">
        <Canvas
          camera={{ position: [1.55, 2.05, 4.35], fov: 38, near: 0.1, far: 80 }}
          dpr={[1, quality.dprMax]}
          shadows={shadowsEnabled ? 'soft' : false}
          gl={{ antialias, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          onCreated={({ gl, camera, scene }) => {
            // Stage 2: premium industrial look is the default (ACES + PCFSoft).
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.18;
            camera.lookAt(-0.45, 0.58, 0.08);
            camera.updateProjectionMatrix();
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.shadowMap.autoUpdate = true;
            if (typeof window !== 'undefined') {
              (window as unknown as { __R3F_CAPTURE?: unknown }).__R3F_CAPTURE = {
                gl, camera, scene,
              };
            }
            // Stage 2D: 1024 shadow map — major cost saver vs default 2048+.
            if (gl.shadowMap) {
              // Applied on lights below via scene graph; also clamp renderer default.
            }
            if (proto && !stage0!.toneMapping) {
              gl.toneMapping = THREE.NoToneMapping;
            }
            const canvas = gl.domElement;
            const handleLost = (event: Event) => {
              event.preventDefault();
              if (!canvas.isConnected) return;
              onContextLost?.();
            };
            const handleRestored = () => {
              if (!canvas.isConnected) return;
              onContextRestored?.();
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
            canvas.addEventListener('webglcontextrestored', handleRestored, false);
          }}
        >
          <Suspense fallback={null}>
            <ContinuousScene
              playback={playback}
              simplified={useSimplified}
              autoCameraEnabled={autoCameraEnabled}
              viewportType={viewportType}
              stage0={stage0}
              stage1={stage1}
              maxVisibleItems={quality.maxVisibleItems}
              shadowsEnabled={shadowsEnabled}
              debugOverlays={debugOverlays}
              physicsDebug={physicsDebug}
            />
            {perfEnabled ? (
              <PerfCollector
                enabled
                mode={mode}
                shadows={shadowsEnabled}
                antialias={antialias}
              />
            ) : null}
            {proto && stage0!.adaptive ? <AdaptiveQualityController initialMode={mode} /> : null}
            {proto && stage0!.post ? (
              <Suspense fallback={null}>
                <PostProcessingSpike />
              </Suspense>
            ) : null}
          </Suspense>
        </Canvas>
      </div>
      {perfEnabled ? <PerfOverlay enabled /> : null}
    </div>
  );
}
