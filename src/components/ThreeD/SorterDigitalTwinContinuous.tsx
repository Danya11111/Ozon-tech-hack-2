/**
 * SorterDigitalTwinContinuous — 3D scene for continuous playback on main page.
 * Light warehouse-style scene with white-blue palette.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, Html, Line } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import type { Mesh, Group } from 'three';
import type { ContinuousPlaybackState, CasePhase } from '../../domain/continuousPlayback';
import { isDetectionActive, isRoutingActive, getPhaseProgress } from '../../domain/continuousPlayback';
import { getItemPosition, isItemVisible, getActiveRoute, getConveyorSpeedFactor, CONVEYOR_POSITIONS } from '../../domain/conveyorPath';
import { shouldShowBoundingBox, shouldShowScanEffect, shouldShowShapeOutline, shouldHighlightCamera } from '../../domain/inspectionViewModel';
import { getModelAsset } from '../../data/modelAssets';
import { ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';

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

/** Single animated roller that rotates around its own axis */
function Roller({ position, speedFactor }: { position: [number, number, number]; speedFactor: number }) {
  const meshRef = useRef<Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current && speedFactor > 0) {
      meshRef.current.rotation.x += delta * speedFactor * 3;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.035, 0.035, 0.72, 12]} />
      <meshStandardMaterial color={COLORS.rollers} metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

/** Moving stripe on conveyor belt */
function BeltStripe({ offset, speedFactor }: { offset: number; speedFactor: number }) {
  const meshRef = useRef<Mesh>(null);
  const posRef = useRef(offset);
  
  useFrame((_, delta) => {
    if (meshRef.current && speedFactor > 0) {
      posRef.current += delta * speedFactor * 1.0;
      if (posRef.current > 4.4) posRef.current = -4.4;
      meshRef.current.position.x = posRef.current;
    }
  });

  return (
    <mesh ref={meshRef} position={[offset, 0.36, 0]}>
      <boxGeometry args={[0.15, 0.01, 0.65]} />
      <meshStandardMaterial color={COLORS.beltStripe} transparent opacity={0.6} />
    </mesh>
  );
}

/** Conveyor belt - light warehouse style */
function ConveyorBelt({ speedFactor }: { speedFactor: number }) {
  const rollerPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 18; i++) {
      positions.push([-4 + i * 0.5, 0.28, 0]);
    }
    return positions;
  }, []);

  return (
    <group>
      {/* Conveyor frame / base */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[9.0, 0.08, 0.95]} />
        <meshStandardMaterial color={COLORS.conveyorFrame} />
      </mesh>
      
      {/* Support legs */}
      {[-3.5, -1, 1.5, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.8]} />
          <meshStandardMaterial color={COLORS.supports} />
        </mesh>
      ))}
      
      {/* Main belt surface */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[8.8, 0.06, 0.7]} />
        <meshStandardMaterial color={COLORS.belt} />
      </mesh>
      
      {/* Belt stripes (animated) */}
      {[-4, -2, 0, 2, 4].map((offset, i) => (
        <BeltStripe key={i} offset={offset} speedFactor={speedFactor} />
      ))}
      
      {/* Side guards */}
      <mesh position={[0, 0.38, 0.42]}>
        <boxGeometry args={[8.8, 0.1, 0.06]} />
        <meshStandardMaterial color={COLORS.sideGuards} />
      </mesh>
      <mesh position={[0, 0.38, -0.42]}>
        <boxGeometry args={[8.8, 0.1, 0.06]} />
        <meshStandardMaterial color={COLORS.sideGuards} />
      </mesh>
      
      {/* Rollers - each rotates independently */}
      {rollerPositions.map((pos, i) => (
        <Roller key={i} position={pos} speedFactor={speedFactor} />
      ))}
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

/** Camera rig with overhead structure */
function CameraRig({ active }: { active: boolean }) {
  return (
    <group position={[CONVEYOR_POSITIONS.cameraX, 0, 0]}>
      {/* Overhead frame */}
      <mesh position={[0, 1.1, 0.5]}>
        <boxGeometry args={[0.06, 0.06, 1.2]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, -0.5]}>
        <boxGeometry args={[0.06, 0.06, 1.2]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Cross beam */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.06, 0.06, 1.1]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Support poles */}
      <mesh position={[0, 0.55, 0.55]}>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, -0.55]}>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Camera unit */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.15]} />
        <meshStandardMaterial 
          color={active ? COLORS.sensorActive : '#1e3a5f'}
          emissive={active ? COLORS.sensorActive : '#000'}
          emissiveIntensity={active ? 0.5 : 0}
        />
      </mesh>
      {/* Camera lens */}
      <mesh position={[0, 0.93, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Laser emitters on sides */}
      <mesh position={[0.15, 0.55, 0.45]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial 
          color={active ? '#22d3ee' : '#475569'}
          emissive={active ? '#22d3ee' : '#000'}
          emissiveIntensity={active ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[-0.15, 0.55, 0.45]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial 
          color={active ? '#22d3ee' : '#475569'}
          emissive={active ? '#22d3ee' : '#000'}
          emissiveIntensity={active ? 0.4 : 0}
        />
      </mesh>
    </group>
  );
}

/** Inspection zone on belt */
function InspectionZone({ active }: { active: boolean }) {
  return (
    <group position={[CONVEYOR_POSITIONS.cameraX, 0.36, 0]}>
      {/* Inspection area rectangle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.7]} />
        <meshStandardMaterial 
          color={active ? COLORS.sensorActive : '#94a3b8'}
          transparent 
          opacity={active ? 0.2 : 0.05}
        />
      </mesh>
      {/* Corner markers */}
      {[[-0.4, 0.3], [0.4, 0.3], [-0.4, -0.3], [0.4, -0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.03, 0.05, 4]} />
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

/** Animated scan line */
function ScanLine({ active }: { active: boolean }) {
  const lineRef = useRef<Mesh>(null);
  const posRef = useRef(0.35);
  const dirRef = useRef(-1);
  
  useFrame((_, delta) => {
    if (lineRef.current && active) {
      posRef.current += dirRef.current * delta * 0.8;
      if (posRef.current < -0.35) {
        posRef.current = -0.35;
        dirRef.current = 1;
      }
      if (posRef.current > 0.35) {
        posRef.current = 0.35;
        dirRef.current = -1;
      }
      lineRef.current.position.z = posRef.current;
    }
  });

  if (!active) return null;

  return (
    <mesh ref={lineRef} position={[CONVEYOR_POSITIONS.cameraX, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.85, 0.02]} />
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

/** Gate/accumulator zone */
function GateZone({ category }: { category: Category | null }) {
  const gateColor = category === 'B' ? COLORS.routeB 
    : category === 'C' ? COLORS.routeC 
    : category === 'D' ? COLORS.routeD 
    : COLORS.gateFrame;
  
  return (
    <group position={[CONVEYOR_POSITIONS.gateX, 0.35, 0]}>
      {/* Gate posts */}
      <mesh position={[0, 0.25, 0.48]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, -0.48]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
        <meshStandardMaterial color={COLORS.gateFrame} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Gate bar */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.06, 0.06, 0.88]} />
        <meshStandardMaterial color={gateColor} />
      </mesh>
    </group>
  );
}

/** Route arrows showing active path */
function RouteArrows({ activeRoute }: { activeRoute: Category | null }) {
  const routes = [
    { category: 'B' as Category, color: COLORS.routeB, endPos: [CONVEYOR_POSITIONS.zoneBX, 0.35, 0] as [number, number, number] },
    { category: 'C' as Category, color: COLORS.routeC, endPos: [CONVEYOR_POSITIONS.gateX + 0.6, 0.35, CONVEYOR_POSITIONS.zoneCZ] as [number, number, number] },
    { category: 'D' as Category, color: COLORS.routeD, endPos: [CONVEYOR_POSITIONS.gateX + 0.6, 0.35, CONVEYOR_POSITIONS.zoneDZ] as [number, number, number] },
  ];

  return (
    <group>
      {routes.map(({ category, color, endPos }) => {
        const isActive = activeRoute === category;
        if (!isActive) return null;
        
        return (
          <group key={category}>
            <mesh position={[
              (CONVEYOR_POSITIONS.gateX + endPos[0]) / 2,
              0.36,
              endPos[2] / 2
            ]}>
              <boxGeometry args={[
                category === 'B' ? Math.abs(endPos[0] - CONVEYOR_POSITIONS.gateX) : 0.4,
                0.03,
                category !== 'B' ? Math.abs(endPos[2]) : 0.03
              ]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={0.3}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Animated item based on playback state */
function PlaybackItem({ playback }: { playback: ContinuousPlaybackState }) {
  const position = getItemPosition(playback);
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
  
  const dims = itemData.dimensionsMm;
  const scale = Math.min(0.35, Math.max(0.12, Math.max(dims.width, dims.depth, dims.height) / 900));
  
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

  return (
    <>
      <group position={pos}>
        {asset?.fallbackPrimitive === 'cylinder' || isRound ? (
          <mesh>
            <cylinderGeometry args={[scale * 0.45, scale * 0.45, scale * 0.7, 16]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={isRouting ? 0.3 : 0.1}
            />
          </mesh>
        ) : (
          <mesh>
            <boxGeometry args={[scale * 0.9, scale * 0.6, scale * 0.9]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={isRouting ? 0.3 : 0.1}
            />
          </mesh>
        )}
        {/* Shadow on belt */}
        <mesh position={[0, -scale * 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[scale * 0.5, 16]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.15} />
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

/** Main continuous scene - light warehouse style */
function ContinuousScene({ playback, simplified }: { playback: ContinuousPlaybackState; simplified: boolean }) {
  const speedFactor = getConveyorSpeedFactor(playback);
  const detectionActive = isDetectionActive(playback);
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

      {/* Conveyor */}
      <ConveyorBelt speedFactor={speedFactor} />

      {/* Zones */}
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.spawnX, 0.01, 0]} 
        label="A" 
        color={COLORS.sensorAccent} 
        active={playback.currentPhase === 'spawn'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.zoneBX, 0.01, 0]} 
        label="B" 
        color={COLORS.routeB} 
        active={activeRoute === 'B'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.gateX + 0.8, 0.01, CONVEYOR_POSITIONS.zoneCZ]} 
        label="C" 
        color={COLORS.routeC} 
        active={activeRoute === 'C'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.gateX + 0.8, 0.01, CONVEYOR_POSITIONS.zoneDZ]} 
        label="D" 
        color={COLORS.routeD} 
        active={activeRoute === 'D'}
      />

      {/* Camera rig with overhead structure */}
      <CameraRig active={cameraHighlight} />
      
      {/* Inspection zone on belt */}
      <InspectionZone active={cameraHighlight} />
      
      {/* Animated scan line */}
      <ScanLine active={showScan} />

      {/* Gate */}
      <GateZone category={category} />

      {/* Route arrows - only when active */}
      <RouteArrows activeRoute={activeRoute} />

      {/* Item with bounding box and shape outline */}
      <PlaybackItem playback={playback} />

      <OrbitControls
        enablePan={!simplified}
        enableZoom
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={12}
        target={[0.5, 0.35, 0]}
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
          camera={{ position: [5.5, 4.0, 5.5], fov: 42 }}
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
