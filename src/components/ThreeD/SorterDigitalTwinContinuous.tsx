/**
 * SorterDigitalTwinContinuous — 3D scene for continuous playback on main page.
 * Light warehouse-style scene with white-blue palette.
 * 
 * Physical dimensions (1 unit = 1 meter):
 * - Belt top surface: 0.7m from floor
 * - Belt width: 0.5m
 * - Items ride ON the belt surface
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, Html, Line } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import type { Mesh, Group } from 'three';
import type { ContinuousPlaybackState, CasePhase } from '../../domain/continuousPlayback';
import { isDetectionActive, isRoutingActive, getPhaseProgress } from '../../domain/continuousPlayback';
import { getItemPosition, isItemVisible, getActiveRoute, getConveyorSpeedFactor } from '../../domain/conveyorPath';
import { shouldShowBoundingBox, shouldShowScanEffect, shouldShowShapeOutline, shouldHighlightCamera } from '../../domain/inspectionViewModel';
import { getModelAsset } from '../../data/modelAssets';
import { ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';
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
} from '../../domain/physicalLayout';

export interface SorterDigitalTwinContinuousProps {
  playback: ContinuousPlaybackState;
  simplified?: boolean;
  onContextLost?: () => void;
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

/** Stepper motor drive unit */
function StepperMotor({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Motor body */}
      <mesh position={[0, 0, CONVEYOR_WIDTH_M / 2 + MOTOR_DEPTH_M / 2 + 0.02]}>
        <boxGeometry args={[MOTOR_WIDTH_M, MOTOR_HEIGHT_M, MOTOR_DEPTH_M]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Motor shaft */}
      <mesh position={[0, 0, CONVEYOR_WIDTH_M / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Drive pulley */}
      <mesh position={[0, 0, CONVEYOR_WIDTH_M / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Belt to drive roller (simplified) */}
      <mesh position={[0, DRIVE_ROLLER_RADIUS_M / 2, CONVEYOR_WIDTH_M / 2 - 0.02]}>
        <boxGeometry args={[0.01, DRIVE_ROLLER_RADIUS_M + 0.02, 0.015]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
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
function ConveyorBelt({ speedFactor }: { speedFactor: number }) {
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
      <StepperMotor position={[CONVEYOR_END_X - 0.1, ROLLER_Y, 0]} />
      
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

/** Zone markers with labels */
function ZoneMarker({ position, label, color, active }: {
  position: [number, number, number];
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={active ? 0.35 : 0.12}
        />
      </mesh>
      <Html position={[0, 0.2, 0]} center>
        <div style={{
          color: active ? color : '#64748b',
          fontSize: '22px',
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

/** 
 * Animated item based on playback state.
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
  
  // Convert mm to meters for visual dimensions
  const dims = itemData.dimensionsMm;
  const visualWidth = dims.width / 1000;    // W in meters
  const visualDepth = dims.depth / 1000;    // D in meters  
  const visualHeight = dims.height / 1000;  // H in meters
  
  // Scale factor for visibility (items are small, scale up for demo)
  const scaleFactor = 2.0;
  const w = visualWidth * scaleFactor;
  const d = visualDepth * scaleFactor;
  const h = visualHeight * scaleFactor;
  
  // Get position with correct height calculation
  const position = getItemPosition(playback, h);
  
  const colors: Record<Category, string> = {
    B: COLORS.routeB,
    C: COLORS.routeC,
    D: COLORS.routeD,
  };
  const color = category ? colors[category] : COLORS.sensorAccent;
  const isRouting = isRoutingActive(playback);
  
  const showBBox = shouldShowBoundingBox(phase);
  const showShape = shouldShowShapeOutline(phase);
  
  if (!visible) return null;

  const pos: [number, number, number] = [position.x, position.y, position.z];
  const scale = Math.max(w, d, h);

  return (
    <>
      <group position={pos}>
        {asset?.fallbackPrimitive === 'cylinder' || isRound ? (
          <mesh>
            <cylinderGeometry args={[Math.max(w, d) / 2, Math.max(w, d) / 2, h, 16]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={isRouting ? 0.3 : 0.1}
            />
          </mesh>
        ) : (
          <mesh>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={isRouting ? 0.3 : 0.1}
            />
          </mesh>
        )}
        {/* Shadow on belt - at belt surface */}
        <mesh position={[0, -h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(w, d) / 2 + 0.02, 16]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.12} />
        </mesh>
      </group>
      
      {/* Bounding box during measurement */}
      <BoundingBoxVisual 
        position={pos} 
        scale={scale} 
        visible={showBBox} 
        isRound={isRound}
      />
      
      {/* Shape outline during classification */}
      <ShapeOutline 
        position={pos} 
        scale={scale} 
        visible={showShape} 
        isRound={isRound}
        category={category}
      />
    </>
  );
}

/** Main continuous scene - light warehouse style with correct physical dimensions */
function ContinuousScene({ playback, simplified }: { playback: ContinuousPlaybackState; simplified: boolean }) {
  const speedFactor = getConveyorSpeedFactor(playback);
  const activeRoute = getActiveRoute(playback);
  const category = playback.targetCategory;
  const phase = playback.currentPhase;
  
  const cameraHighlight = shouldHighlightCamera(phase);
  const showScan = shouldShowScanEffect(phase);

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
      <ConveyorBelt speedFactor={speedFactor} />

      {/* Zone markers on floor */}
      <ZoneMarker 
        position={[ZONES.A.x, 0.01, ZONES.A.z]} 
        label="A" 
        color={COLORS.sensorAccent} 
        active={playback.currentPhase === 'spawn'}
      />
      <ZoneMarker 
        position={[ZONES.B.x, 0.01, ZONES.B.z]} 
        label="B" 
        color={COLORS.routeB} 
        active={activeRoute === 'B'}
      />
      <ZoneMarker 
        position={[ZONES.C.x, 0.01, ZONES.C.z]} 
        label="C" 
        color={COLORS.routeC} 
        active={activeRoute === 'C'}
      />
      <ZoneMarker 
        position={[ZONES.D.x, 0.01, ZONES.D.z]} 
        label="D" 
        color={COLORS.routeD} 
        active={activeRoute === 'D'}
      />

      {/* Camera rig - overhead above belt */}
      <CameraRig active={cameraHighlight} />
      
      {/* Inspection zone on belt surface */}
      <InspectionZone active={cameraHighlight} />
      
      {/* Animated scan line on belt */}
      <ScanLine active={showScan} />

      {/* Gate/diverter */}
      <GateZone category={category} />

      {/* Route arrows on belt surface */}
      <RouteArrows activeRoute={activeRoute} />

      {/* Item riding ON the belt */}
      <PlaybackItem playback={playback} />

      <OrbitControls
        enablePan={!simplified}
        enableZoom
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
            <ContinuousScene playback={playback} simplified={simplified} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
