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
import { getItemPosition, isItemVisible, getActiveRoute, getConveyorSpeedFactor } from '../../domain/conveyorPath';
import { shouldShowBoundingBox, shouldShowScanEffect, shouldShowShapeOutline, shouldHighlightCamera } from '../../domain/inspectionViewModel';
import { getMeasurementData, shouldShowLaserBeam, shouldShowStepperPulse, shouldShowPointCloud, shouldShowActuator } from '../../domain/measurementSystem';
import { getModelAsset } from '../../data/modelAssets';
import { ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';
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
} from '../../domain/physicalLayout';

export interface SorterDigitalTwinContinuousProps {
  playback: ContinuousPlaybackState;
  simplified?: boolean;
  onContextLost?: () => void;
  autoCameraEnabled?: boolean;
  viewportType?: ViewportType;
}

/** Light color palette */
const COLORS = {
  background: '#f6f9ff',
  floor: '#eaf2ff',
  gridCell: '#c9d8ee',
  gridSection: '#a8c0de',
  conveyorFrame: '#d8e6f8',
  belt: '#7aa2d8',
  beltStripe: '#9bc0eb',
  sideGuards: '#9bb7d8',
  rollers: '#b7c8dc',
  supports: '#c7d8ef',
  sensorAccent: '#2563eb',
  sensorActive: '#38bdf8',
  gateFrame: '#94a3b8',
  routeB: '#22c55e',
  routeC: '#f97316',
  routeD: '#8b5cf6',
};

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
    const pos = getItemPosition(playback);
    return [pos.x, pos.y, pos.z] as [number, number, number];
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

/** Moving stripe on conveyor belt - animates at belt surface */
function BeltStripe({ offset, speedFactor }: { offset: number; speedFactor: number }) {
  const meshRef = useRef<Mesh>(null);
  const posRef = useRef(offset);
  
  useFrame((_, delta) => {
    if (meshRef.current && speedFactor > 0) {
      posRef.current += delta * speedFactor * 1.0;
      if (posRef.current > CONVEYOR_END_X) posRef.current = CONVEYOR_START_X;
      meshRef.current.position.x = posRef.current;
    }
  });

  return (
    <mesh ref={meshRef} position={[offset, BELT_Y + 0.002, 0]}>
      <boxGeometry args={[0.12, 0.004, CONVEYOR_WIDTH_M - 0.05]} />
      <meshStandardMaterial color={COLORS.beltStripe} transparent opacity={0.5} />
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
function ConveyorBelt({ speedFactor, pulseActive }: { speedFactor: number; pulseActive: boolean }) {
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
      {/* Main belt surface - top working surface at 0.7m */}
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y - BELT_THICKNESS_M / 2, 0]}>
        <boxGeometry args={[CONVEYOR_LENGTH, BELT_THICKNESS_M, CONVEYOR_WIDTH_M]} />
        <meshStandardMaterial color={COLORS.belt} />
      </mesh>
      
      {/* Belt stripes (animated) - moving on belt surface */}
      {[-4, -2.5, -1, 0.5, 2, 3.5].map((offset, i) => (
        <BeltStripe key={i} offset={offset} speedFactor={speedFactor} />
      ))}
      
      {/* Side guards - above belt level */}
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, CONVEYOR_WIDTH_M / 2 + 0.02]}>
        <boxGeometry args={[CONVEYOR_LENGTH, SIDE_GUARD_HEIGHT_M, 0.03]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.2} roughness={0.7} />
      </mesh>
      <mesh position={[CONVEYOR_CENTER_X, BELT_Y + SIDE_GUARD_HEIGHT_M / 2, -CONVEYOR_WIDTH_M / 2 - 0.02]}>
        <boxGeometry args={[CONVEYOR_LENGTH, SIDE_GUARD_HEIGHT_M, 0.03]} />
        <meshStandardMaterial color={COLORS.sideGuards} metalness={0.2} roughness={0.7} />
      </mesh>
      
      {/* Frame rails under the belt */}
      <mesh position={[CONVEYOR_CENTER_X, FRAME_TOP_Y + 0.025, CONVEYOR_WIDTH_M / 2 + 0.01]}>
        <boxGeometry args={[CONVEYOR_LENGTH, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[CONVEYOR_CENTER_X, FRAME_TOP_Y + 0.025, -CONVEYOR_WIDTH_M / 2 - 0.01]}>
        <boxGeometry args={[CONVEYOR_LENGTH, 0.05, 0.04]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} metalness={0.3} roughness={0.5} />
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
  emissiveIntensity,
}: { 
  path: string; 
  scale: [number, number, number]; 
  color: string;
  emissiveIntensity: number;
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
    <mesh geometry={geometry} scale={scale}>
      <meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
      />
    </mesh>
  );
}

/** Fallback primitive when STL is not available */
function FallbackPrimitive({ 
  type, 
  color, 
  emissiveIntensity,
  w, h, d, 
}: { 
  type: 'box' | 'cylinder' | 'sphere';
  color: string;
  emissiveIntensity: number;
  w: number; h: number; d: number;
}) {
  if (type === 'cylinder' || type === 'sphere') {
    return (
      <mesh>
        <cylinderGeometry args={[Math.max(w, d) / 2, Math.max(w, d) / 2, h, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} />
      </mesh>
    );
  }
  
  return (
    <mesh>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
}

/** 
 * Animated item based on playback state.
 * Uses real STL models with true physical scale (1 unit = 1 meter).
 * Item sits ON the belt surface (bottom of item at BELT_TOP_Y).
 */
function PlaybackItem({ playback }: { playback: ContinuousPlaybackState }) {
  const visible = isItemVisible(playback);
  const category = playback.targetCategory;
  const phase = playback.currentPhase;
  
  const currentCase = playback.currentCase;
  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = useMemo(() => {
    try {
      return ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
    } catch {
      return ITEMS[0];
    }
  }, [itemId]);
  
  const asset = getModelAsset(itemId);
  const isRound = itemData.roundness >= 0.7 || asset?.fallbackPrimitive === 'cylinder';
  
  // Get rendered dimensions in meters (true physical scale)
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);
  const w = dims.width;
  const d = dims.depth;
  const h = dims.height;
  
  // Calculate Y position so item sits ON belt
  const itemCenterY = getItemYOnBelt(h);
  
  // Get XZ position from playback
  const basePosition = getItemPosition(playback, h);
  const pos: [number, number, number] = [basePosition.x, itemCenterY, basePosition.z];
  
  const colors: Record<Category, string> = {
    B: COLORS.routeB,
    C: COLORS.routeC,
    D: COLORS.routeD,
  };
  const color = category ? colors[category] : COLORS.sensorAccent;
  const isRouting = isRoutingActive(playback);
  const emissiveIntensity = isRouting ? 0.3 : 0.1;
  
  const showBBox = shouldShowBoundingBox(phase);
  const showShape = shouldShowShapeOutline(phase);
  
  if (!visible) return null;

  // Determine if we should use STL
  const useSTL = asset?.loaderType === 'stl' && asset?.frontendAssetPath;
  const stlPath = asset?.frontendAssetPath ?? '';
  const fallbackPrimitive = asset?.fallbackPrimitive ?? 'box';
  
  // Scale for STL models (STL files are in mm, need to convert to meters)
  const stlScale: [number, number, number] = [0.001, 0.001, 0.001];
  
  const visualScale = Math.max(w, d, h);

  return (
    <>
      <group position={pos}>
        {useSTL ? (
          <Suspense fallback={
            <FallbackPrimitive 
              type={fallbackPrimitive} 
              color={color} 
              emissiveIntensity={emissiveIntensity}
              w={w} h={h} d={d}
            />
          }>
            <STLGeometry 
              path={stlPath}
              scale={stlScale}
              color={color}
              emissiveIntensity={emissiveIntensity}
            />
          </Suspense>
        ) : (
          <FallbackPrimitive 
            type={isRound ? 'cylinder' : fallbackPrimitive} 
            color={color} 
            emissiveIntensity={emissiveIntensity}
            w={w} h={h} d={d}
          />
        )}
        
        {/* Shadow on belt */}
        <mesh position={[0, -h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(w, d) / 2 + 0.01, 16]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.1} />
        </mesh>
      </group>
      
      {/* Bounding box during measurement */}
      <BoundingBoxVisual 
        position={pos} 
        scale={visualScale} 
        visible={showBBox} 
        isRound={isRound}
      />
      
      {/* Shape outline during classification */}
      <ShapeOutline 
        position={pos} 
        scale={visualScale} 
        visible={showShape} 
        isRound={isRound}
        category={category}
      />
    </>
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
  const activeRoute = getActiveRoute(playback);
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
  
  // Get item position for measurement visualization
  const itemPosition = getItemPosition(playback);
  const itemPos: [number, number, number] = [itemPosition.x, itemPosition.y, itemPosition.z];
  
  // Get item data for point cloud (use true physical scale)
  const currentCase = playback.currentCase;
  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
  const isRound = itemData.roundness >= 0.7;
  const dims = getRenderedItemDimensions(itemData.dimensionsMm);
  const itemScale = Math.max(dims.width, dims.depth, dims.height);
  
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
      
      {/* Bright lighting */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 5]} intensity={1.2} />
      <directionalLight position={[-4, 6, -3]} intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#e0e8f0', 0.6]} />

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

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>

      {/* Conveyor - belt top at 0.7m */}
      <ConveyorBelt speedFactor={speedFactor} pulseActive={showPulse} />

      {/* Zone A - spawn point */}
      <ZoneMarker 
        position={[ZONES.A.x, 0.01, ZONES.A.z]} 
        label="A" 
        color={COLORS.sensorAccent} 
        active={playback.currentPhase === 'spawn'}
      />
      
      {/* Zone B - main sorter exit */}
      <ZoneMarker 
        position={[ZONES.B.x, 0.01, ZONES.B.z]} 
        label="B" 
        color={COLORS.routeB} 
        active={activeRoute === 'B'}
      />
      
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
      <LaserBeam active={showLaser} itemY={itemPosition.y} />
      
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

      {/* Item riding ON the belt */}
      <PlaybackItem playback={playback} />
      
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
