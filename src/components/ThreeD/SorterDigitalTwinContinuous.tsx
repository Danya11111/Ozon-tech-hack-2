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
import { PhysicalPlaybackItem } from './PhysicalPlaybackItem';
import { PhysicalPlaybackItemPhysics } from './PhysicalPlaybackItemPhysics';
import { PusherMechanism } from './PusherMechanism';
import { RealSenseD435i, RealSenseFrustumDebug, D435I } from './RealSenseD435i';
import { ConveyorCadModel, CONVEYOR_CAD_SPAN_X, preloadConveyorCad } from './ConveyorCadModel';
import { SorterPhysicsWorld } from './SorterPhysics';
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
  BELT_THICKNESS_M,
  CONVEYOR_WIDTH_M,
  ROLLER_RADIUS_M,
  ROLLER_SPACING_M,
  FRAME_HEIGHT_M,
  SIDE_GUARD_HEIGHT_M,
  LEG_WIDTH_M,
  MOTOR_WIDTH_M,
  MOTOR_HEIGHT_M,
  MOTOR_DEPTH_M,
  DRIVE_ROLLER_RADIUS_M,
  ZONES,
  CAMERA_RIG,
  LASER_HEIGHT_M,
  STEREO_CAMERA,
  ROLL_CAGE,
  getRenderedItemDimensions,
  B_RECEIVER,
  CAGE_FLOOR_Y,
  CONVEYOR_SPEED_MPS,
} from '../../domain/physicalLayout';
import { CHUTE_PITCH, CHUTE_LENGTH, CHUTE_MID_Y, CHUTE_MID_Z, CHUTE_X, CHUTE_HALF_W } from '../../domain/physicsWorldLayout';
import PerfCollector from './PerfCollector';
import PerfOverlay from './PerfOverlay';
import RollCageMesh from './RollCageMesh';
import { getPreloadAssets } from '../../data/modelAssets';
import { preloadRealItemModel } from './RealItemModel';
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

// Physical layout constants
const BELT_Y = BELT_TOP_Y;                    // 0.7m - top of belt where items ride
const BELT_UNDERSIDE_Y = BELT_TOP_Y - BELT_THICKNESS_M; // 0.685m
const ROLLER_Y = BELT_UNDERSIDE_Y - ROLLER_RADIUS_M;    // ~0.645m - roller center
const FRAME_TOP_Y = ROLLER_Y - ROLLER_RADIUS_M - 0.02;  // Top of frame structure
const CONVEYOR_START_X = -4.2;
const CONVEYOR_END_X = B_RECEIVER.transferEndX + 0.15; // main belt ends at short B spur tip
/** Max items rendered simultaneously (perf cap). */
const MAX_VISIBLE_ITEMS = 6;
/** Heavy animated overlays off by default for smooth demo. */
const ENABLE_DEMO_EFFECTS = false;
const CONVEYOR_LENGTH = CONVEYOR_END_X - CONVEYOR_START_X;
void CONVEYOR_LENGTH;

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

/** Static roller cylinder — no per-frame rotation (belt stripes show movement). */
function StaticRoller({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[ROLLER_RADIUS_M, ROLLER_RADIUS_M, CONVEYOR_WIDTH_M - 0.02, 8]} />
      <meshStandardMaterial color={COLORS.rollers} metalness={0.4} roughness={0.5} />
    </mesh>
  );
}

/**
 * Moving stripe on conveyor belt.
 * Position is DETERMINISTIC from playback time (offset = time * 1 m/s), so the
 * belt animation shares the exact tempo/direction of the item, is FPS-independent,
 * freezes on pause and resets on stop.
 */
function BeltStripe({ baseOffset, elapsedMs }: { baseOffset: number; elapsedMs: number }) {
  const beltLen = CONVEYOR_END_X - CONVEYOR_START_X;
  const shift = ((elapsedMs / 1000) * CONVEYOR_SPEED_MPS) % beltLen;
  let x = baseOffset + shift;
  if (x > CONVEYOR_END_X) x -= beltLen;

  return (
    <mesh position={[x, BELT_Y + 0.001, 0]}>
      <boxGeometry args={[0.08, 0.002, CONVEYOR_WIDTH_M - 0.06]} />
      <meshStandardMaterial 
        color={COLORS.beltStripe} 
        transparent 
        opacity={0.25}
        roughness={0.9}
      />
    </mesh>
  );
}

/** Stepper motor drive unit with pulse indicator */
function StepperMotor({ position, pulseActive }: { position: [number, number, number]; pulseActive: boolean }) {
  const pulseRef = useRef<Mesh>(null);
  const rotationRef = useRef(0);
  
  useFrame((_, delta) => {
    if (pulseRef.current && pulseActive) {
      rotationRef.current += delta * 8;
      pulseRef.current.rotation.z = rotationRef.current;
    }
  });
  
  return (
    <group position={position}>
      {/* Motor body */}
      <mesh position={[0, 0, CONVEYOR_WIDTH_M / 2 + MOTOR_DEPTH_M / 2 + 0.02]}>
        <boxGeometry args={[MOTOR_WIDTH_M, MOTOR_HEIGHT_M, MOTOR_DEPTH_M]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Motor shaft - rotates when active */}
      <mesh 
        ref={pulseRef}
        position={[0, 0, CONVEYOR_WIDTH_M / 2 + 0.01]} 
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Drive pulley */}
      <mesh position={[0, 0, CONVEYOR_WIDTH_M / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Belt to drive roller */}
      <mesh position={[0, DRIVE_ROLLER_RADIUS_M / 2, CONVEYOR_WIDTH_M / 2 - 0.02]}>
        <boxGeometry args={[0.01, DRIVE_ROLLER_RADIUS_M + 0.02, 0.015]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Pulse indicator LED */}
      <mesh position={[0, MOTOR_HEIGHT_M / 2 - 0.01, CONVEYOR_WIDTH_M / 2 + MOTOR_DEPTH_M + 0.025]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial 
          color={pulseActive ? '#22d3ee' : '#475569'}
          emissive={pulseActive ? '#22d3ee' : '#000'}
          emissiveIntensity={pulseActive ? 0.8 : 0}
        />
      </mesh>
    </group>
  );
}

/** Laser beam from rangefinder to item — static opacity, no useFrame. */
function LaserBeam({ active, itemY }: { active: boolean; itemY: number }) {
  if (!active) return null;

  const beamLength = LASER_HEIGHT_M - itemY;
  const beamCenterY = itemY + beamLength / 2;

  return (
    <group position={[ZONES.CAMERA.x, 0, 0]}>
      <mesh position={[0, beamCenterY, 0]}>
        <cylinderGeometry args={[0.003, 0.003, beamLength, 8]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Laser dot on item */}
      <mesh position={[0, itemY + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.015, 16]} />
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

/** Support leg from floor to frame */
function SupportLeg({ x }: { x: number }) {
  const legHeight = FRAME_TOP_Y;
  return (
    <group position={[x, 0, 0]}>
      {/* Main vertical leg - front */}
      <mesh position={[0, legHeight / 2, CONVEYOR_WIDTH_M / 2 + 0.03]}>
        <boxGeometry args={[LEG_WIDTH_M, legHeight, LEG_WIDTH_M]} />
        <meshStandardMaterial color={COLORS.supports} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Main vertical leg - back */}
      <mesh position={[0, legHeight / 2, -CONVEYOR_WIDTH_M / 2 - 0.03]}>
        <boxGeometry args={[LEG_WIDTH_M, legHeight, LEG_WIDTH_M]} />
        <meshStandardMaterial color={COLORS.supports} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Cross brace */}
      <mesh position={[0, legHeight * 0.3, 0]}>
        <boxGeometry args={[LEG_WIDTH_M * 0.8, LEG_WIDTH_M * 0.8, CONVEYOR_WIDTH_M + 0.1]} />
        <meshStandardMaterial color={COLORS.supports} metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** 
 * Conveyor belt - realistic roller conveyor
 * Belt top surface at 0.7m (BELT_TOP_Y)
 */
/**
 * Belt extension segment (SPEC_DERIVED) — entry/exit sections flanking the
 * CAD conveyor module. Same 500 mm width / 700 mm belt top as the real unit.
 */
function BeltSection({ startX, endX, simplified, shadows }: { startX: number; endX: number; simplified: boolean; shadows: boolean }) {
  const spacing = simplified ? ROLLER_SPACING_M * 2 : ROLLER_SPACING_M;
  const length = endX - startX;
  const centerX = (startX + endX) / 2;
  const rollerCount = Math.max(1, Math.floor(length / spacing));

  const rollerPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < rollerCount; i++) {
      positions.push([startX + spacing / 2 + i * spacing, ROLLER_Y, 0]);
    }
    return positions;
  }, [rollerCount, spacing, startX]);

  const legPositions = useMemo(() => {
    const positions: number[] = [];
    for (let x = startX + 0.5; x < endX - 0.3; x += 2.0) {
      positions.push(x);
    }
    return positions;
  }, [startX, endX]);

  return (
    <group>
      <mesh position={[centerX, BELT_Y - BELT_THICKNESS_M / 2, 0]} receiveShadow={shadows}>
        <boxGeometry args={[length, BELT_THICKNESS_M, CONVEYOR_WIDTH_M]} />
        <meshStandardMaterial color={COLORS.belt} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[centerX, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, CONVEYOR_WIDTH_M / 2 + 0.02]}>
        <boxGeometry args={[length, SIDE_GUARD_HEIGHT_M, 0.025]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[centerX, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, -CONVEYOR_WIDTH_M / 2 - 0.02]}>
        <boxGeometry args={[length, SIDE_GUARD_HEIGHT_M, 0.025]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[centerX, FRAME_TOP_Y + 0.025, CONVEYOR_WIDTH_M / 2 + 0.01]} castShadow={shadows}>
        <boxGeometry args={[length, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[centerX, FRAME_TOP_Y + 0.025, -CONVEYOR_WIDTH_M / 2 - 0.01]} castShadow={shadows}>
        <boxGeometry args={[length, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      {rollerPositions.map((pos, i) => (
        <StaticRoller key={i} position={pos} />
      ))}
      {legPositions.map((x, i) => (
        <SupportLeg key={i} x={x} />
      ))}
    </group>
  );
}

/**
 * Conveyor: CAD module (REAL_CAD) + entry/exit belt extensions (SPEC_DERIVED).
 * Gate/roller/belt motion is driven by the domain visual-state adapter.
 */
function ConveyorBelt({ pulseActive, elapsedMs, simplified, shadows = false, gateOpen = false, beltVelocityMps = 0, rollerOmega = 0 }: { pulseActive: boolean; elapsedMs: number; simplified: boolean; shadows?: boolean; gateOpen?: boolean; beltVelocityMps?: number; rollerOmega?: number }) {
  const stripeOffsets = simplified ? [-2, 0, 2] : [-3, -1, 0.5, 2];
  const [cadStart, cadEnd] = CONVEYOR_CAD_SPAN_X;

  return (
    <group>
      {/* CAD-derived conveyor module (real machine: frame, belt, rollers,
          drive, metering gates, servo diverters, camera arch) */}
      <Suspense fallback={null}>
        <ConveyorCadModel
          gateOpen={gateOpen}
          beltVelocityMps={beltVelocityMps}
          rollerOmegaRadPerSec={rollerOmega}
          shadows={shadows}
        />
      </Suspense>

      {/* Entry extension: zone A feed into the CAD module */}
      <BeltSection startX={CONVEYOR_START_X} endX={cadStart} simplified={simplified} shadows={shadows} />
      {/* Exit extension: CAD module discharge to the B spur */}
      <BeltSection startX={cadEnd} endX={CONVEYOR_END_X} simplified={simplified} shadows={shadows} />

      {/* Belt stripes — deterministic movement synced to item (offset = time * 1 m/s) */}
      {stripeOffsets.map((offset, i) => (
        <BeltStripe key={i} baseOffset={offset} elapsedMs={elapsedMs} />
      ))}

      {/* Drive roller at end (larger) */}
      <mesh position={[CONVEYOR_END_X - 0.1, ROLLER_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[DRIVE_ROLLER_RADIUS_M, DRIVE_ROLLER_RADIUS_M, CONVEYOR_WIDTH_M - 0.02, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Tension roller at start (larger) */}
      <mesh position={[CONVEYOR_START_X + 0.1, ROLLER_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[DRIVE_ROLLER_RADIUS_M * 0.9, DRIVE_ROLLER_RADIUS_M * 0.9, CONVEYOR_WIDTH_M - 0.02, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Stepper motor at drive end */}
      <StepperMotor position={[CONVEYOR_END_X - 0.1, ROLLER_Y, 0]} pulseActive={pulseActive} />

      {/* End caps / guards */}
      <mesh position={[CONVEYOR_START_X, BELT_Y - 0.05, 0]}>
        <boxGeometry args={[0.05, 0.12, CONVEYOR_WIDTH_M + 0.1]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} />
      </mesh>
      <mesh position={[CONVEYOR_END_X, BELT_Y - 0.05, 0]}>
        <boxGeometry args={[0.05, 0.12, CONVEYOR_WIDTH_M + 0.1]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} />
      </mesh>
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
function BReceiverBin({ active }: { active: boolean }) {
  const { centerX, centerZ, width, depth, wallHeight, floorY, transferEndX, transferStartX } = B_RECEIVER;
  const emissive = active ? 0.3 : 0.04;
  const hx = width / 2;
  const hz = depth / 2;
  const wall = 0.03;
  const entryX = centerX - hx + 0.1;
  const spurLen = transferEndX - transferStartX;

  return (
    <group>
      {/* Short B-only transfer spur (not a full belt extension) */}
      <mesh position={[(transferStartX + transferEndX) / 2, BELT_Y - 0.02, 0]}>
        <boxGeometry args={[spurLen, 0.04, CONVEYOR_WIDTH_M - 0.06]} />
        <meshStandardMaterial color="#64748b" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Spur side rails */}
      {[-1, 1].map((s) => (
        <mesh key={`spur${s}`} position={[(transferStartX + transferEndX) / 2, BELT_Y + 0.04, s * (CONVEYOR_WIDTH_M / 2 - 0.02)]}>
          <boxGeometry args={[spurLen, 0.06, 0.02]} />
          <meshStandardMaterial color={COLORS.routeB} transparent opacity={0.55} />
        </mesh>
      ))}

      {/* Drop chute into bin — descends toward +X (sign matches collider) */}
      <mesh
        position={[(transferEndX + entryX) / 2, (BELT_Y + floorY) / 2 + 0.02, centerZ]}
        rotation={[0, 0, -Math.atan2(BELT_Y - floorY, entryX - transferEndX)]}
      >
        <boxGeometry args={[Math.hypot(entryX - transferEndX, BELT_Y - floorY), 0.015, CONVEYOR_WIDTH_M - 0.08]} />
        <meshStandardMaterial color="#4ade80" transparent opacity={0.5} emissive={COLORS.routeB} emissiveIntensity={emissive} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor pad under bin */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.001, centerZ]}>
        <planeGeometry args={[width + 0.25, depth + 0.25]} />
        <meshStandardMaterial color={COLORS.routeB} transparent opacity={active ? 0.18 : 0.06} />
      </mesh>

      {/* Bin interior floor */}
      <mesh position={[centerX, floorY - 0.01, centerZ]}>
        <boxGeometry args={[width - 0.06, 0.025, depth - 0.06]} />
        <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Bin walls — 3 sides + low front lip */}
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[centerX, floorY + wallHeight / 2, centerZ + s * hz]}>
          <boxGeometry args={[width, wallHeight, wall]} />
          <meshStandardMaterial color="#3f6f52" roughness={0.7} metalness={0.25} emissive={COLORS.routeB} emissiveIntensity={emissive} />
        </mesh>
      ))}
      <mesh position={[centerX + hx, floorY + wallHeight / 2, centerZ]}>
        <boxGeometry args={[wall, wallHeight, depth]} />
        <meshStandardMaterial color="#3f6f52" roughness={0.7} metalness={0.25} emissive={COLORS.routeB} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[entryX, floorY + wallHeight / 4, centerZ]}>
        <boxGeometry args={[wall, wallHeight / 3, depth - 0.1]} />
        <meshStandardMaterial color="#3f6f52" roughness={0.7} metalness={0.25} transparent opacity={0.85} />
      </mesh>

      {/* Corner posts */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={`post${i}`} position={[centerX + sx * (hx - 0.04), floorY + wallHeight / 2, centerZ + sz * (hz - 0.04)]}>
          <boxGeometry args={[0.04, wallHeight, 0.04]} />
          <meshStandardMaterial color="#3f6f52" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* Legs to floor */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={`leg${i}`} position={[centerX + sx * (hx - 0.08), floorY / 2, centerZ + sz * (hz - 0.08)]}>
          <boxGeometry args={[0.05, floorY, 0.05]} />
          <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      <Html position={[centerX, floorY + wallHeight + 0.25, centerZ]} center>
        <div style={{
          color: active ? COLORS.routeB : '#64748b',
          fontSize: '22px',
          fontWeight: 800,
          userSelect: 'none',
        }}>
          B
        </div>
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
      {/* Chute surface — steep gravity chute toward the cage open front */}
      <mesh
        position={[CHUTE_X, CHUTE_MID_Y - 0.01, midZ]}
        rotation={rot}
      >
        <boxGeometry args={[chuteWidth, 0.02, CHUTE_LENGTH]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={active ? 0.7 : 0.3}
          emissive={color}
          emissiveIntensity={active ? 0.2 : 0}
        />
      </mesh>
      {/* Side rails — follow the chute pitch */}
      <mesh position={[CHUTE_X - CHUTE_HALF_W - 0.01, CHUTE_MID_Y + 0.035, midZ]} rotation={rot}>
        <boxGeometry args={[0.02, 0.07, CHUTE_LENGTH]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[CHUTE_X + CHUTE_HALF_W + 0.01, CHUTE_MID_Y + 0.035, midZ]} rotation={rot}>
        <boxGeometry args={[0.02, 0.07, CHUTE_LENGTH]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Camera rig with overhead structure - positioned above belt at 0.7m */
function CameraRig({ active }: { active: boolean }) {
  const cameraX = ZONES.CAMERA.x;
  const poleSpacing = CAMERA_RIG.poleSpacing;
  const rigHeight = CAMERA_RIG.height;
  const cameraY = CAMERA_RIG.cameraY;
  const poleHeight = rigHeight;
  
  return (
    <group position={[cameraX, 0, 0]}>
      {/* Support poles from floor */}
      <mesh position={[0, poleHeight / 2, poleSpacing]}>
        <cylinderGeometry args={[0.03, 0.03, poleHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, poleHeight / 2, -poleSpacing]}>
        <cylinderGeometry args={[0.03, 0.03, poleHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Cross beam */}
      <mesh position={[0, rigHeight, 0]}>
        <boxGeometry args={[0.05, 0.05, poleSpacing * 2 + 0.1]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Mount arm from cross beam down to the camera bracket */}
      <mesh position={[0, (rigHeight + cameraY) / 2, 0]}>
        <boxGeometry args={[0.04, rigHeight - cameraY + 0.04, 0.04]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Camera bracket plate (attaches to the tripod boss) */}
      <mesh position={[0, cameraY + 0.022, 0]}>
        <boxGeometry args={[0.05, 0.006, 0.12]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Intel RealSense D435i (SPEC_DERIVED, official datasheet dimensions) */}
      <group position={[0, cameraY, 0]}>
        <RealSenseD435i />
        {/* Status LED while measuring */}
        <mesh position={[D435I.depth / 2 + 0.002, 0.004, 0]}>
          <boxGeometry args={[0.002, 0.004, 0.006]} />
          <meshStandardMaterial
            color={active ? '#22c55e' : '#14532d'}
            emissive={active ? '#22c55e' : '#000'}
            emissiveIntensity={active ? 1.2 : 0}
          />
        </mesh>
      </group>
      {/* Line-laser triangulation module at 1.15 m (separate from camera
          optical center 1.35 m — project doc height) */}
      <mesh position={[0.12, 1.15, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.05, 0.04, 0.09]} />
        <meshStandardMaterial color="#2b3138" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0.135, 1.128, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.012, 0.008, 0.05]} />
        <meshStandardMaterial
          color={active ? '#ef4444' : '#7f1d1d'}
          emissive={active ? '#ef4444' : '#000'}
          emissiveIntensity={active ? 0.9 : 0}
        />
      </mesh>
      {/* Laser emitters on support poles */}
      <mesh position={[0, BELT_Y + 0.15, poleSpacing - 0.05]}>
        <boxGeometry args={[0.06, 0.06, 0.06]} />
        <meshStandardMaterial 
          color={active ? '#22d3ee' : '#475569'}
          emissive={active ? '#22d3ee' : '#000'}
          emissiveIntensity={active ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[0, BELT_Y + 0.15, -poleSpacing + 0.05]}>
        <boxGeometry args={[0.06, 0.06, 0.06]} />
        <meshStandardMaterial 
          color={active ? '#22d3ee' : '#475569'}
          emissive={active ? '#22d3ee' : '#000'}
          emissiveIntensity={active ? 0.4 : 0}
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

/** Gate/accumulator zone - positioned at belt height */
function GateZone({ category, shadows = false }: { category: Category | null; shadows?: boolean }) {
  const gateColor = category === 'B' ? COLORS.routeB
    : category === 'C' ? COLORS.routeC
    : category === 'D' ? COLORS.routeD
    : COLORS.gateFrame;

  const gateX = ZONES.GATE.x;
  const postSpacing = CONVEYOR_WIDTH_M / 2 + 0.08;
  const postHeight = 0.4;

  return (
    <group position={[gateX, 0, 0]}>
      {/* Gate posts from floor */}
      <mesh position={[0, BELT_Y + postHeight / 2, postSpacing]} castShadow={shadows}>
        <cylinderGeometry args={[0.035, 0.035, postHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, BELT_Y + postHeight / 2, -postSpacing]} castShadow={shadows}>
        <cylinderGeometry args={[0.035, 0.035, postHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Gate bar */}
      <mesh position={[0, BELT_Y + postHeight, 0]} castShadow={shadows}>
        <boxGeometry args={[0.05, 0.05, postSpacing * 2]} />
        <meshStandardMaterial color={gateColor} />
      </mesh>
      {/* Diverter indicator on belt */}
      <mesh position={[0, BELT_Y + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, CONVEYOR_WIDTH_M - 0.05]} />
        <meshStandardMaterial 
          color={gateColor} 
          transparent 
          opacity={category ? 0.3 : 0.1}
        />
      </mesh>
    </group>
  );
}

/** Route arrows showing active path - at belt height */
function RouteArrows({ activeRoute }: { activeRoute: Category | null }) {
  const gateX = ZONES.GATE.x;
  const routes = [
    { category: 'B' as Category, color: COLORS.routeB, endX: ZONES.B.x, endZ: 0 },
    { category: 'C' as Category, color: COLORS.routeC, endX: gateX + 0.5, endZ: ZONES.C.z },
    { category: 'D' as Category, color: COLORS.routeD, endX: gateX + 0.5, endZ: ZONES.D.z },
  ];

  return (
    <group>
      {routes.map(({ category, color, endX, endZ }) => {
        const isActive = activeRoute === category;
        if (!isActive) return null;
        
        return (
          <group key={category}>
            <mesh position={[
              (gateX + endX) / 2,
              BELT_Y + 0.005,
              endZ / 2
            ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[
                category === 'B' ? Math.abs(endX - gateX) : 0.3,
                category !== 'B' ? Math.abs(endZ) : CONVEYOR_WIDTH_M - 0.1
              ]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={0.3}
                transparent
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}
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
  const isRound = itemData.roundness >= 0.7;
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);

  // Stage 1 real-model verification overlay (debug only, read-only)
  const verifySku = stage1?.enabled && stage1.verify === 'real-models'
    ? (stage1.sku ?? itemId)
    : null;

  // Preload the default playlist's real assets once per scene mount
  // (deduped by loader cache; rare SKUs stay lazy — Stage 1 §19 budget).
  useEffect(() => {
    for (const asset of getPreloadAssets()) {
      if (asset.runtimePath) preloadRealItemModel(asset.runtimePath);
    }
    preloadConveyorCad();
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
      {/* Background: light warehouse by default; dark cinematic in prototype mode */}
      <color attach="background" args={[darkBg ? INDUSTRIAL_PALETTE.backgroundDark : COLORS.background]} />

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
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#39506e', '#1a2434', 1.1]} />
          <directionalLight
            position={[6, 9, 4]}
            intensity={2.6}
            castShadow={protoShadows}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={7}
            shadow-camera-bottom={-7}
            shadow-camera-near={1}
            shadow-camera-far={25}
            shadow-bias={-0.0004}
          />
          <directionalLight position={[-5, 6, -3]} intensity={0.65} />
          <directionalLight position={[2, 5, -8]} intensity={0.9} color="#bcd7ff" />
          {/* low front fill so the +Z face (camera side) never goes black */}
          <directionalLight position={[1, 3, 8]} intensity={0.5} color="#cfdcf2" />
          {/* Procedural studio environment (no external HDRI — offline-safe) */}
          {protoShadows && (
            <Environment resolution={128} frames={1}>
              <Lightformer intensity={1.6} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#dfe9ff" />
              <Lightformer intensity={0.7} position={[-5, 2, -4]} rotation-y={Math.PI / 3} scale={[4, 2, 1]} color="#b8c8e8" />
              <Lightformer intensity={0.5} position={[5, 1.5, 3]} rotation-y={-Math.PI / 4} scale={[3, 1.5, 1]} color="#ffe9c8" />
            </Environment>
          )}
        </>
      )}

      {/* Grid */}
      <Grid
        args={[16, 12]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor={darkBg ? '#22303f' : COLORS.gridCell}
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor={darkBg ? '#2f4256' : COLORS.gridSection}
        fadeDistance={12}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Floor — dark polished concrete with soft reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={protoShadows}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial
          color={darkBg ? '#1c2534' : COLORS.floor}
          roughness={darkBg ? 0.55 : 0.9}
          metalness={darkBg ? 0.25 : 0}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Conveyor: CAD module + SPEC_DERIVED extensions — belt top at 0.7m */}
      <ConveyorBelt
        pulseActive={showPulse}
        elapsedMs={totalElapsedMs}
        simplified={liteScene}
        shadows={protoShadows}
        gateOpen={visualState.gateOpen}
        beltVelocityMps={visualState.beltVelocityMps}
        rollerOmega={visualState.rollerOmegaRadPerSec}
      />

      {/* Zone A - spawn point */}
      <ZoneMarker 
        position={[ZONES.A.x, 0.01, ZONES.A.z]} 
        label="A" 
        color={COLORS.sensorAccent} 
        active={playback.currentPhase === 'spawn'}
      />
      
      {/* Zone B - physical receiving bin at end of sorter */}
      <BReceiverBin active={activeRoute === 'B'} />
      
      {/* Zone C - roll cage for oversized items */}
      <RollCage
        position={[ZONES.C.x, 0, ZONES.C.z]}
        label="C"
        color={COLORS.routeC}
        active={activeRoute === 'C'}
        shadows={protoShadows}
      />

      {/* Zone D - roll cage for round items */}
      <RollCage
        position={[ZONES.D.x, 0, ZONES.D.z]}
        label="D"
        color={COLORS.routeD}
        active={activeRoute === 'D'}
        shadows={protoShadows}
      />
      
      {/* Chutes for routing to C/D */}
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

      {/* Camera rig - overhead above belt, carries the D435i + line laser */}
      <CameraRig active={cameraHighlight} />

      {/* §9.4 debug: optical axis / FOV / measurement zone (debug only) */}
      {(physicsDebug || debugOverlays) && <RealSenseFrustumDebug />}

      {/* Laser beam for height measurement */}
      <LaserBeam active={showLaser} itemY={itemPos[1]} />
      
      {/* Point cloud for stereo analysis — opt-in only */}
      {effectsEnabled && (
        <PointCloud
          active={showCloud}
          itemPosition={itemPos}
          scale={itemScale}
          isRound={isRound}
        />
      )}
      
      {/* Inspection zone on belt surface */}
      <InspectionZone active={cameraHighlight} />
      
      {/* Animated scan line on belt — opt-in only */}
      {effectsEnabled && <ScanLine active={showScan} />}

      {/* Gate/diverter */}
      <GateZone category={category} shadows={protoShadows} />

      {/* Route arrows on belt surface */}
      <RouteArrows activeRoute={activeRoute} />

      {/* Items: kinematic on the belt (domain truth), rigid-body physics
          after the drop handoff, verified against the domain receiver.
          The angled paddle diverter lives in the same physics world and
          physically contacts the items (Stage 2B §13). */}
      <SorterPhysicsWorld running={playback.status === 'running'} speed={playback.speed}>
        <PusherMechanism
          category={category}
          routingElapsedMs={caseElapsedMs - getRoutingStartMs()}
          castShadow={protoShadows}
        />
        {sceneItems.map(item => (
          <PhysicalPlaybackItemPhysics
            key={item.id}
            caseData={item.caseData}
            elapsedMs={item.elapsedMs}
            slotIndex={item.slotIndex}
            verifySku={verifySku}
            jitter={item.slotIndex === currentCaseIndex ? positionJitter : undefined}
            castShadow={protoShadows}
          />
        ))}
      </SorterPhysicsWorld>
      
      {/* Outline/BBox for the CURRENT item only */}
      <BoundingBoxVisual 
        position={itemPos} 
        scale={itemScale} 
        visible={shouldShowBoundingBox(phase)} 
        isRound={isRound}
      />
      <ShapeOutline 
        position={itemPos} 
        scale={itemScale} 
        visible={shouldShowShapeOutline(phase)} 
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
          camera={{ position: [4.3, 2.9, 4.6], fov: 46 }}
          dpr={[1, quality.dprMax]}
          shadows={shadowsEnabled ? 'soft' : false}
          gl={{ antialias, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            // Stage 2: premium industrial look is the default (ACES + PCFSoft).
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.15;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
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
