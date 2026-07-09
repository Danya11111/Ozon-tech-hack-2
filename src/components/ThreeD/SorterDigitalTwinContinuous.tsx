/**
 * SorterDigitalTwinContinuous — 3D scene for continuous playback on main page.
 * Light warehouse-style scene with white-blue palette.
 * 
 * Physical dimensions (1 unit = 1 meter):
 * - Belt top surface: 0.7m from floor
 * - Belt width: 0.5m
 * - Items ride ON the belt surface
 */

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Html, Line } from '@react-three/drei';
import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import type { Mesh, Group, BufferGeometry } from 'three';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ContinuousPlaybackState, CasePhase } from '../../domain/continuousPlayback';
import { isDetectionActive, isRoutingActive, getPhaseProgress } from '../../domain/continuousPlayback';
import { getConveyorSpeedFactor } from '../../domain/conveyorPath';
import { getPhysicalItemPose } from '../../domain/physicalItemMotion';
import { shouldShowBoundingBox, shouldShowScanEffect, shouldShowShapeOutline, shouldHighlightCamera } from '../../domain/inspectionViewModel';
import { getMeasurementData, shouldShowLaserBeam, shouldShowStepperPulse, shouldShowPointCloud, shouldShowActuator } from '../../domain/measurementSystem';
import { getModelAsset } from '../../data/modelAssets';
import { ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';
import { PhysicalPlaybackItem } from './PhysicalPlaybackItem';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from '../../domain/demoPlaylist';
import { CASE_DURATION_MS } from '../../domain/continuousPlayback';
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
  getItemYOnBelt,
  B_RECEIVER,
  CAGE_FLOOR_Y,
  CONVEYOR_SPEED_MPS,
} from '../../domain/physicalLayout';

export interface SorterDigitalTwinContinuousProps {
  playback: ContinuousPlaybackState;
  simplified?: boolean;
  onContextLost?: () => void;
  autoCameraEnabled?: boolean;
  viewportType?: ViewportType;
}

/** 
 * Refined color palette - warehouse aesthetic 
 * Belt: matte PVC/tarpaulin look (blue-gray, not glossy)
 * Frame: industrial metal gray
 * Accents: subtle, not overly bright
 */
const COLORS = {
  background: '#f4f7fb',
  floor: '#e8eef6',
  gridCell: '#d0dae8',
  gridSection: '#b8c8dc',
  conveyorFrame: '#8a9bb0',      // Industrial metal gray
  belt: '#6b8298',              // Matte PVC blue-gray
  beltStripe: '#7d96ad',        // Subtle stripe
  sideGuards: '#7a8fa3',        // Metal guards
  rollers: '#9aa8b8',           // Brushed metal
  supports: '#a0afc0',          // Support legs
  motor: '#5a6a7a',             // Dark motor housing
  sensorAccent: '#3b82f6',      // Blue sensor (less saturated)
  sensorActive: '#60a5fa',      // Active state
  gateFrame: '#7a8a9a',         // Gate metal
  routeB: '#16a34a',            // Green (softer)
  routeC: '#ea580c',            // Orange (softer)
  routeD: '#7c3aed',            // Purple (softer)
  itemShadow: '#3a4a5a',        // Contact shadow
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
const CONVEYOR_END_X = 4.3;
const CONVEYOR_LENGTH = CONVEYOR_END_X - CONVEYOR_START_X;
const CONVEYOR_CENTER_X = (CONVEYOR_START_X + CONVEYOR_END_X) / 2;

/** Cinematic camera controller - smoothly transitions between camera angles */
function CinematicCameraController({ 
  playback, 
  enabled, 
  viewportType = 'desktop' 
}: { 
  playback: ContinuousPlaybackState; 
  enabled: boolean;
  viewportType: ViewportType;
}) {
  const { camera } = useThree();
  const cameraStateRef = useRef<CameraConfig>(getInitialCameraConfig(viewportType));
  const isRunning = playback.status === 'running';
  
  // Get item position for camera following
  const itemPosition = useMemo(() => {
    if (playback.status === 'idle') return null;
    const currentItemElapsed = playback.totalElapsedMs - (playback.currentCaseIndex * CASE_DURATION_MS);
    const pose = getPhysicalItemPose({
      caseId: playback.currentCase.id,
      dimensionsMm: { width: 300, depth: 200, height: 200 }, // rough approx for camera target
      targetCategory: playback.targetCategory,
      elapsedMs: currentItemElapsed,
      slotIndex: playback.currentCaseIndex
    });
    return pose.position;
  }, [playback]);
  
  useFrame(() => {
    if (!enabled || !isRunning) return;
    
    // Get target camera config for current phase
    const targetConfig = getCameraConfig(
      playback.currentPhase,
      playback.targetCategory,
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

/** Single animated roller that rotates around its own axis */
function Roller({ position, speedFactor }: { position: [number, number, number]; speedFactor: number }) {
  const meshRef = useRef<Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current && speedFactor > 0) {
      meshRef.current.rotation.x += delta * speedFactor * 4;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[ROLLER_RADIUS_M, ROLLER_RADIUS_M, CONVEYOR_WIDTH_M - 0.02, 12]} />
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

/** Laser beam from rangefinder to item */
function LaserBeam({ active, itemY }: { active: boolean; itemY: number }) {
  const beamRef = useRef<Mesh>(null);
  const opacityRef = useRef(0.6);
  
  useFrame((_, delta) => {
    if (beamRef.current && active) {
      opacityRef.current = 0.4 + Math.sin(Date.now() / 100) * 0.3;
    }
  });
  
  if (!active) return null;
  
  const beamLength = LASER_HEIGHT_M - itemY;
  const beamCenterY = itemY + beamLength / 2;
  
  return (
    <group position={[ZONES.CAMERA.x, 0, 0]}>
      {/* Main laser beam */}
      <mesh ref={beamRef} position={[0, beamCenterY, 0]}>
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

/** Stereo camera lenses with view cones */
function StereoCameraLenses({ active, itemPosition }: { active: boolean; itemPosition: [number, number, number] }) {
  const baseline = STEREO_CAMERA.baseline;
  const mountY = STEREO_CAMERA.mountY;
  const cameraX = ZONES.CAMERA.x;
  
  return (
    <group position={[cameraX, mountY, 0]}>
      {/* Left lens */}
      <mesh position={[0, 0, baseline / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.015, 12]} />
        <meshStandardMaterial 
          color={active ? '#0ea5e9' : '#1e293b'}
          emissive={active ? '#0ea5e9' : '#000'}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
      {/* Right lens */}
      <mesh position={[0, 0, -baseline / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.015, 12]} />
        <meshStandardMaterial 
          color={active ? '#0ea5e9' : '#1e293b'}
          emissive={active ? '#0ea5e9' : '#000'}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
      {/* View cones when active */}
      {active && (
        <>
          <Line
            points={[
              [0, 0, baseline / 2],
              [0, itemPosition[1] - mountY, itemPosition[2]],
            ]}
            color="#0ea5e9"
            lineWidth={1}
            transparent
            opacity={0.3}
          />
          <Line
            points={[
              [0, 0, -baseline / 2],
              [0, itemPosition[1] - mountY, itemPosition[2]],
            ]}
            color="#0ea5e9"
            lineWidth={1}
            transparent
            opacity={0.3}
          />
        </>
      )}
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

/** Actuator/pusher animation during routing */
function ActuatorPusher({ active, category }: { active: boolean; category: Category | null }) {
  const pusherRef = useRef<Mesh>(null);
  const extendRef = useRef(0);
  
  useFrame((_, delta) => {
    if (pusherRef.current) {
      const target = active && (category === 'C' || category === 'D') ? 0.15 : 0;
      extendRef.current += (target - extendRef.current) * delta * 5;
      
      const direction = category === 'C' ? 1 : -1;
      pusherRef.current.position.z = direction * extendRef.current;
    }
  });
  
  const gateX = ZONES.GATE.x;
  const color = category === 'C' ? COLORS.routeC : category === 'D' ? COLORS.routeD : COLORS.gateFrame;
  
  return (
    <mesh 
      ref={pusherRef}
      position={[gateX + 0.3, BELT_Y + 0.08, 0]}
    >
      <boxGeometry args={[0.15, 0.08, 0.06]} />
      <meshStandardMaterial 
        color={color}
        emissive={active ? color : '#000'}
        emissiveIntensity={active ? 0.3 : 0}
        metalness={0.5}
        roughness={0.4}
      />
    </mesh>
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
function ConveyorBelt({ speedFactor, pulseActive, elapsedMs }: { speedFactor: number; pulseActive: boolean; elapsedMs: number }) {
  const rollerCount = Math.floor(CONVEYOR_LENGTH / ROLLER_SPACING_M);
  
  const rollerPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < rollerCount; i++) {
      positions.push([CONVEYOR_START_X + ROLLER_SPACING_M / 2 + i * ROLLER_SPACING_M, ROLLER_Y, 0]);
    }
    return positions;
  }, [rollerCount]);

  const legPositions = useMemo(() => {
    const positions: number[] = [];
    for (let x = CONVEYOR_START_X + 0.5; x < CONVEYOR_END_X - 0.3; x += 2.0) {
      positions.push(x);
    }
    return positions;
  }, []);

  return (
    <group>
      {/* Main belt surface - matte PVC/tarpaulin look at 0.7m */}
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y - BELT_THICKNESS_M / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[CONVEYOR_LENGTH, BELT_THICKNESS_M, CONVEYOR_WIDTH_M]} />
        <meshStandardMaterial 
          color={COLORS.belt} 
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      
      {/* Belt stripes — deterministic movement synced to item (offset = time * 1 m/s) */}
      {[-4, -2.5, -1, 0.5, 2, 3.5].map((offset, i) => (
        <BeltStripe key={i} baseOffset={offset} elapsedMs={elapsedMs} />
      ))}
      
      {/* Side guards - brushed metal above belt */}
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, CONVEYOR_WIDTH_M / 2 + 0.02]} castShadow>
        <boxGeometry args={[CONVEYOR_LENGTH, SIDE_GUARD_HEIGHT_M, 0.025]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, -CONVEYOR_WIDTH_M / 2 - 0.02]} castShadow>
        <boxGeometry args={[CONVEYOR_LENGTH, SIDE_GUARD_HEIGHT_M, 0.025]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.4} roughness={0.5} />
      </mesh>
      
      {/* Frame rails - industrial metal */}
      <mesh position={[CONVEYOR_CENTER_X, FRAME_TOP_Y + 0.025, CONVEYOR_WIDTH_M / 2 + 0.01]} castShadow>
        <boxGeometry args={[CONVEYOR_LENGTH, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[CONVEYOR_CENTER_X, FRAME_TOP_Y + 0.025, -CONVEYOR_WIDTH_M / 2 - 0.01]} castShadow>
        <boxGeometry args={[CONVEYOR_LENGTH, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      
      {/* Rollers - rotating under the belt */}
      {rollerPositions.map((pos, i) => (
        <Roller key={i} position={pos} speedFactor={speedFactor} />
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
      
      {/* Support legs from floor */}
      {legPositions.map((x, i) => (
        <SupportLeg key={i} x={x} />
      ))}
      
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
 * B receiving zone — physical downstream receiving tray after the sorter.
 * A short 0.5m-wide tray at belt height (0.7m) with low side walls and an end
 * stop, so B items visibly land and remain instead of vanishing into thin air.
 */
function BReceiver({ active }: { active: boolean }) {
  const { startX, endX, y, width, wallHeight } = B_RECEIVER;
  const len = endX - startX;
  const centerX = (startX + endX) / 2;
  const emissive = active ? 0.35 : 0.05;
  const legY = y / 2;

  return (
    <group>
      {/* Tray floor at belt height */}
      <mesh position={[centerX, y - 0.02, 0]} receiveShadow>
        <boxGeometry args={[len, 0.04, width]} />
        <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[centerX, y + wallHeight / 2, s * (width / 2)]}>
          <boxGeometry args={[len, wallHeight, 0.02]} />
          <meshStandardMaterial color={COLORS.routeB} transparent opacity={0.55} emissive={COLORS.routeB} emissiveIntensity={emissive} />
        </mesh>
      ))}
      {/* End stop wall */}
      <mesh position={[endX, y + wallHeight / 2, 0]}>
        <boxGeometry args={[0.03, wallHeight, width]} />
        <meshStandardMaterial color={COLORS.routeB} transparent opacity={0.6} emissive={COLORS.routeB} emissiveIntensity={emissive} />
      </mesh>
      {/* Support legs */}
      {[startX + 0.2, endX - 0.2].map((lx) => (
        [-1, 1].map((s) => (
          <mesh key={`${lx}-${s}`} position={[lx, legY, s * (width / 2 - 0.05)]}>
            <boxGeometry args={[0.04, y, 0.04]} />
            <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.5} roughness={0.4} />
          </mesh>
        ))
      ))}
      {/* Label */}
      <Html position={[centerX, y + wallHeight + 0.18, 0]} center>
        <div style={{
          color: active ? COLORS.routeB : '#64748b',
          fontSize: '20px',
          fontWeight: 800,
          textShadow: active ? `0 0 8px ${COLORS.routeB}` : 'none',
          userSelect: 'none',
        }}>
          B
        </div>
      </Html>
    </group>
  );
}

/** Roll cage for C/D zones - realistic wireframe cage with wheels */
function RollCage({ position, label, color, active }: {
  position: [number, number, number];
  label: 'C' | 'D';
  color: string;
  active: boolean;
}) {
  const { width, depth, height, wheelRadius, frameThickness } = ROLL_CAGE;
  const ft = frameThickness;
  const emissiveIntensity = active ? 0.4 : 0;
  
  return (
    <group position={position}>
      {/* Floor marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[width + 0.2, depth + 0.2]} />
        <meshStandardMaterial color={color} transparent opacity={active ? 0.25 : 0.08} />
      </mesh>

      {/* Solid interior floor where items rest */}
      <mesh position={[0, CAGE_FLOOR_Y - 0.005, 0]} receiveShadow>
        <boxGeometry args={[width - frameThickness, 0.01, depth - frameThickness]} />
        <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* Cage frame - bottom rectangle */}
      <mesh position={[0, wheelRadius * 2 + ft / 2, depth / 2 - ft / 2]}>
        <boxGeometry args={[width, ft, ft]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[0, wheelRadius * 2 + ft / 2, -depth / 2 + ft / 2]}>
        <boxGeometry args={[width, ft, ft]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[width / 2 - ft / 2, wheelRadius * 2 + ft / 2, 0]}>
        <boxGeometry args={[ft, ft, depth - ft * 2]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[-width / 2 + ft / 2, wheelRadius * 2 + ft / 2, 0]}>
        <boxGeometry args={[ft, ft, depth - ft * 2]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      
      {/* Cage frame - top rectangle */}
      <mesh position={[0, wheelRadius * 2 + height - ft / 2, depth / 2 - ft / 2]}>
        <boxGeometry args={[width, ft, ft]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[0, wheelRadius * 2 + height - ft / 2, -depth / 2 + ft / 2]}>
        <boxGeometry args={[width, ft, ft]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[width / 2 - ft / 2, wheelRadius * 2 + height - ft / 2, 0]}>
        <boxGeometry args={[ft, ft, depth - ft * 2]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[-width / 2 + ft / 2, wheelRadius * 2 + height - ft / 2, 0]}>
        <boxGeometry args={[ft, ft, depth - ft * 2]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
      
      {/* Vertical posts (corners) */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (width / 2 - ft / 2), wheelRadius * 2 + height / 2, sz * (depth / 2 - ft / 2)]}>
          <boxGeometry args={[ft, height - ft, ft]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={emissiveIntensity} />
        </mesh>
      ))}
      
      {/* Caster wheels */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={`wheel-${i}`} position={[sx * (width / 2 - 0.08), wheelRadius, sz * (depth / 2 - 0.08)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[wheelRadius, wheelRadius, 0.03, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      
      {/* Wire mesh sides (simplified - just vertical lines) */}
      {[-1, 1].map((sz) => (
        <group key={`side-${sz}`}>
          {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
            <mesh key={i} position={[-width / 2 + width * t, wheelRadius * 2 + height / 2, sz * (depth / 2 - 0.01)]}>
              <boxGeometry args={[0.008, height - ft * 2, 0.008]} />
              <meshStandardMaterial color={color} transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      
      {/* Label */}
      <Html position={[0, wheelRadius * 2 + height + 0.15, 0]} center>
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

/** Chute/deflector for routing items to C/D */
function RouteChute({ gateX, targetZ, color, active }: {
  gateX: number;
  targetZ: number;
  color: string;
  active: boolean;
}) {
  const chuteLength = Math.abs(targetZ) - CONVEYOR_WIDTH_M / 2 - 0.1;
  const chuteWidth = 0.4;
  const direction = targetZ > 0 ? 1 : -1;
  const midZ = (CONVEYOR_WIDTH_M / 2 + 0.1) * direction + (chuteLength / 2) * direction;
  
  return (
    <group>
      {/* Chute surface - angled slightly down */}
      <mesh 
        position={[gateX + 0.3, BELT_TOP_Y - 0.02, midZ]} 
        rotation={[direction * -0.1, 0, 0]}
      >
        <boxGeometry args={[chuteWidth, 0.02, chuteLength]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={active ? 0.7 : 0.3}
          emissive={color}
          emissiveIntensity={active ? 0.2 : 0}
        />
      </mesh>
      {/* Side rails */}
      <mesh position={[gateX + 0.3 - chuteWidth / 2 - 0.015, BELT_TOP_Y + 0.02, midZ]}>
        <boxGeometry args={[0.02, 0.06, chuteLength]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[gateX + 0.3 + chuteWidth / 2 + 0.015, BELT_TOP_Y + 0.02, midZ]}>
        <boxGeometry args={[0.02, 0.06, chuteLength]} />
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
      {/* Camera unit */}
      <mesh position={[0, cameraY, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.12]} />
        <meshStandardMaterial 
          color={active ? COLORS.sensorActive : '#1e3a5f'}
          emissive={active ? COLORS.sensorActive : '#000'}
          emissiveIntensity={active ? 0.5 : 0}
        />
      </mesh>
      {/* Camera lens */}
      <mesh position={[0, cameraY - 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
        <meshStandardMaterial color="#0f172a" />
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
function GateZone({ category }: { category: Category | null }) {
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
      <mesh position={[0, BELT_Y + postHeight / 2, postSpacing]}>
        <cylinderGeometry args={[0.035, 0.035, postHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, BELT_Y + postHeight / 2, -postSpacing]}>
        <cylinderGeometry args={[0.035, 0.035, postHeight, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Gate bar */}
      <mesh position={[0, BELT_Y + postHeight, 0]}>
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

/** STL geometry loader - always loads the geometry */
function STLGeometry({ 
  path, 
  scale, 
  color, 
  accentColor,
  emissiveIntensity,
  roughness,
  metalness,
}: { 
  path: string; 
  scale: [number, number, number]; 
  color: string;
  accentColor: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}) {
  const geometry = useLoader(STLLoader, path);
  
  // Center and compute normals on first render
  useMemo(() => {
    if (geometry) {
      geometry.center();
      geometry.computeVertexNormals();
    }
  }, [geometry]);
  
  return (
    <group scale={scale}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial 
          color={color}
          emissive={accentColor}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
          metalness={metalness}
        />
      </mesh>
      <lineSegments geometry={new THREE.EdgesGeometry(geometry, 35)}>
        <lineBasicMaterial color={accentColor} transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

/** Fallback primitive when STL is not available */
function FallbackPrimitive({ 
  type, 
  color, 
  accentColor,
  emissiveIntensity,
  roughness,
  metalness,
  w, h, d, 
}: { 
  type: 'box' | 'cylinder' | 'sphere';
  color: string;
  accentColor: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  w: number; h: number; d: number;
}) {
  if (type === 'cylinder' || type === 'sphere') {
    return (
      <mesh castShadow>
        <cylinderGeometry args={[Math.max(w, d) / 2, Math.max(w, d) / 2, h, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={accentColor} 
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
          metalness={metalness}
        />
      </mesh>
    );
  }
  
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial 
          color={color} 
          emissive={accentColor} 
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
          metalness={metalness}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d), 35]} />
        <lineBasicMaterial color={accentColor} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

/** Main continuous scene - light warehouse style with correct physical dimensions */
function ContinuousScene({ 
  playback, 
  simplified,
  autoCameraEnabled,
  viewportType 
}: { 
  playback: ContinuousPlaybackState; 
  simplified: boolean;
  autoCameraEnabled: boolean;
  viewportType: ViewportType;
}) {
  const speedFactor = getConveyorSpeedFactor(playback);
  const category = playback.targetCategory;
  const phase = playback.currentPhase;
  
  const cameraHighlight = shouldHighlightCamera(phase);
  const showScan = shouldShowScanEffect(phase);
  
  // Measurement system states
  const measurementData = getMeasurementData(playback);
  const showLaser = shouldShowLaserBeam(phase);
  const showPulse = shouldShowStepperPulse(phase);
  const showCloud = shouldShowPointCloud(phase);
  const showActuator = shouldShowActuator(phase);
  
  // Compute all physical items based on elapsed time to keep them in roll-cages
  const { totalElapsedMs, currentCase, currentCaseIndex } = playback;
  const casesSpawned = Math.floor(totalElapsedMs / CASE_DURATION_MS) + 1;
  const startIndex = Math.max(0, casesSpawned - 20); // Keep last 20 items

  const sceneItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i < casesSpawned; i++) {
      const playlistIndex = i % PLAYLIST_LENGTH;
      const caseData = DEMO_PLAYLIST[playlistIndex];
      const elapsedMs = totalElapsedMs - (i * CASE_DURATION_MS);
      items.push({
        id: `item-${i}-${caseData.id}`,
        slotIndex: i,
        caseData,
        elapsedMs,
      });
    }
    return items;
  }, [totalElapsedMs, casesSpawned, startIndex]);

  // Get item data for the current case
  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
  const isRound = itemData.roundness >= 0.7;
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);
  const itemScale = Math.max(dims.width, dims.depth, dims.height);
  
  // Get item position for measurement visualization using physical model
  const currentItemElapsed = totalElapsedMs - (currentCaseIndex * CASE_DURATION_MS);
  const currentPose = getPhysicalItemPose({
    caseId: currentCase.id,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: category,
    elapsedMs: currentItemElapsed,
    slotIndex: currentCaseIndex
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
  
  // Cinematic camera active only when running and enabled
  const cinematicActive = autoCameraEnabled && playback.status === 'running';

  return (
    <>
      {/* Light background */}
      <color attach="background" args={[COLORS.background]} />
      
      {/* Soft natural lighting - warehouse aesthetic */}
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#f8fafc', '#d0dae8', 0.5]} />
      {/* Main directional light with soft shadow */}
      <directionalLight 
        position={[8, 12, 6]} 
        intensity={0.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-5, 8, -4]} intensity={0.35} />

      {/* Grid */}
      <Grid
        args={[16, 12]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor={COLORS.gridCell}
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor={COLORS.gridSection}
        fadeDistance={12}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Floor with shadow receiving */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.9} metalness={0} />
      </mesh>

      {/* Conveyor - belt top at 0.7m */}
      <ConveyorBelt speedFactor={speedFactor} pulseActive={showPulse} elapsedMs={totalElapsedMs} />

      {/* Zone A - spawn point */}
      <ZoneMarker 
        position={[ZONES.A.x, 0.01, ZONES.A.z]} 
        label="A" 
        color={COLORS.sensorAccent} 
        active={playback.currentPhase === 'spawn'}
      />
      
      {/* Zone B - physical receiving tray at end of sorter */}
      <BReceiver active={activeRoute === 'B'} />
      
      {/* Zone C - roll cage for oversized items */}
      <RollCage 
        position={[ZONES.C.x, 0, ZONES.C.z]} 
        label="C" 
        color={COLORS.routeC} 
        active={activeRoute === 'C'}
      />
      
      {/* Zone D - roll cage for round items */}
      <RollCage 
        position={[ZONES.D.x, 0, ZONES.D.z]} 
        label="D" 
        color={COLORS.routeD} 
        active={activeRoute === 'D'}
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

      {/* Camera rig - overhead above belt */}
      <CameraRig active={cameraHighlight} />
      
      {/* Stereo camera lenses */}
      <StereoCameraLenses active={cameraHighlight} itemPosition={itemPos} />
      
      {/* Laser beam for height measurement */}
      <LaserBeam active={showLaser} itemY={itemPos[1]} />
      
      {/* Point cloud for stereo analysis */}
      <PointCloud 
        active={showCloud} 
        itemPosition={itemPos} 
        scale={itemScale}
        isRound={isRound}
      />
      
      {/* Inspection zone on belt surface */}
      <InspectionZone active={cameraHighlight} />
      
      {/* Animated scan line on belt */}
      <ScanLine active={showScan} />

      {/* Gate/diverter */}
      <GateZone category={category} />
      
      {/* Actuator pusher for routing */}
      <ActuatorPusher active={showActuator} category={category} />

      {/* Route arrows on belt surface */}
      <RouteArrows activeRoute={activeRoute} />

      {/* Physically simulated items */}
      {sceneItems.map(item => (
        <PhysicalPlaybackItem 
          key={item.id}
          caseData={item.caseData}
          elapsedMs={item.elapsedMs}
          slotIndex={item.slotIndex}
        />
      ))}
      
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
      
      {/* Motion trail for visual movement feedback */}
      <MotionTrail 
        position={itemPos} 
        visible={showMotionTrail} 
        color={itemColor}
        direction={trailDirection as 'x' | 'z'}
      />

      {/* Cinematic camera controller */}
      <CinematicCameraController 
        playback={playback} 
        enabled={cinematicActive}
        viewportType={viewportType}
      />

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

export default function SorterDigitalTwinContinuous({
  playback,
  simplified = false,
  onContextLost,
  autoCameraEnabled = true,
  viewportType = 'desktop',
}: SorterDigitalTwinContinuousProps) {
  return (
    <div className="digital-twin-wrap continuous-twin">
      <div className="digital-twin-canvas continuous-canvas">
        <Canvas
          camera={{ position: [4.5, 3.5, 5.0], fov: 45 }}
          dpr={simplified ? [1, 1.25] : [1, 1.75]}
          shadows={!simplified}
          gl={{ antialias: !simplified, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const handleLost = (event: Event) => {
              event.preventDefault();
              if (!canvas.isConnected) return;
              onContextLost?.();
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
          }}
        >
          <Suspense fallback={null}>
            <ContinuousScene 
              playback={playback} 
              simplified={simplified}
              autoCameraEnabled={autoCameraEnabled}
              viewportType={viewportType}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
