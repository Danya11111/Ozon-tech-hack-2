/**
 * SorterDigitalTwinContinuous — 3D scene for continuous playback on main page.
 * Uses ContinuousPlaybackState instead of SimulationState.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, Html } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import type { Group } from 'three';
import type { ContinuousPlaybackState } from '../../domain/continuousPlayback';
import { isDetectionActive, isRoutingActive, getPhaseProgress } from '../../domain/continuousPlayback';
import { getItemPosition, isItemVisible, getActiveRoute, getConveyorSpeedFactor, CONVEYOR_POSITIONS } from '../../domain/conveyorPath';
import { getModelAsset } from '../../data/modelAssets';
import { getItem, ITEMS } from '../../data/items';
import type { Category } from '../../domain/types';

export interface SorterDigitalTwinContinuousProps {
  playback: ContinuousPlaybackState;
  simplified?: boolean;
  onContextLost?: () => void;
}

/** Conveyor belt with animated rollers. */
function ConveyorBelt({ speedFactor }: { speedFactor: number }) {
  const rollersRef = useRef<Group>(null);
  
  useFrame((_, delta) => {
    if (rollersRef.current && speedFactor > 0) {
      rollersRef.current.rotation.z += delta * speedFactor * 2;
    }
  });

  return (
    <group>
      {/* Main belt */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[8.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#1a2836" />
      </mesh>
      {/* Belt edges */}
      <mesh position={[0, 0.35, 0.45]}>
        <boxGeometry args={[8.8, 0.12, 0.08]} />
        <meshStandardMaterial color="#2a3d52" />
      </mesh>
      <mesh position={[0, 0.35, -0.45]}>
        <boxGeometry args={[8.8, 0.12, 0.08]} />
        <meshStandardMaterial color="#2a3d52" />
      </mesh>
      {/* Rollers */}
      <group ref={rollersRef}>
        {Array.from({ length: 18 }).map((_, i) => (
          <mesh key={i} position={[-4 + i * 0.5, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
            <meshStandardMaterial color="#3a5068" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Zone markers with labels. */
function ZoneMarker({ position, label, color, active }: {
  position: [number, number, number];
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.2, 0.02, 1.2]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={active ? 0.4 : 0.15}
          emissive={color}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
      <Html position={[0, 0.3, 0]} center>
        <div style={{
          color: active ? color : '#6a7a8a',
          fontSize: '24px',
          fontWeight: 900,
          textShadow: active ? `0 0 10px ${color}` : 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Detection zone (camera, laser). */
function DetectionZone({ active }: { active: boolean }) {
  return (
    <group position={[CONVEYOR_POSITIONS.cameraX, 0.5, 0]}>
      {/* Camera indicator */}
      <mesh position={[0, 0.8, 0.6]}>
        <boxGeometry args={[0.2, 0.15, 0.15]} />
        <meshStandardMaterial 
          color={active ? '#38bdf8' : '#2a4a6a'}
          emissive={active ? '#38bdf8' : '#000'}
          emissiveIntensity={active ? 0.5 : 0}
        />
      </mesh>
      {/* Scan beam */}
      {active && (
        <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.8]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

/** Gate/accumulator zone. */
function GateZone({ category }: { category: Category | null }) {
  const gateOpen = category === 'B';
  
  return (
    <group position={[CONVEYOR_POSITIONS.gateX, 0.35, 0]}>
      {/* Gate frame */}
      <mesh position={[0, 0.3, 0.5]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color="#3a5068" />
      </mesh>
      <mesh position={[0, 0.3, -0.5]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color="#3a5068" />
      </mesh>
      {/* Gate bar */}
      <mesh 
        position={[0, 0.5, gateOpen ? 0.6 : 0]} 
        rotation={[0, gateOpen ? Math.PI / 4 : 0, 0]}
      >
        <boxGeometry args={[0.08, 0.08, gateOpen ? 0.3 : 0.9]} />
        <meshStandardMaterial color={gateOpen ? '#4ade80' : '#f59e0b'} />
      </mesh>
    </group>
  );
}

/** Route arrows showing active path. */
function RouteArrows({ activeRoute }: { activeRoute: Category | null }) {
  const routes = [
    { category: 'B' as Category, color: '#4ade80', endPos: [CONVEYOR_POSITIONS.zoneBX, 0.4, 0] as [number, number, number] },
    { category: 'C' as Category, color: '#f59e0b', endPos: [CONVEYOR_POSITIONS.gateX + 0.5, 0.4, CONVEYOR_POSITIONS.zoneCZ] as [number, number, number] },
    { category: 'D' as Category, color: '#c084fc', endPos: [CONVEYOR_POSITIONS.gateX + 0.5, 0.4, CONVEYOR_POSITIONS.zoneDZ] as [number, number, number] },
  ];

  return (
    <group>
      {routes.map(({ category, color, endPos }) => {
        const isActive = activeRoute === category;
        return (
          <group key={category}>
            {/* Arrow line */}
            <mesh position={[
              (CONVEYOR_POSITIONS.gateX + endPos[0]) / 2,
              0.38,
              endPos[2] / 2
            ]}>
              <boxGeometry args={[
                category === 'B' ? Math.abs(endPos[0] - CONVEYOR_POSITIONS.gateX) : 0.5,
                0.04,
                category !== 'B' ? Math.abs(endPos[2]) : 0.04
              ]} />
              <meshStandardMaterial 
                color={color} 
                transparent 
                opacity={isActive ? 0.8 : 0.2}
                emissive={color}
                emissiveIntensity={isActive ? 0.4 : 0}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Animated item based on playback state. */
function PlaybackItem({ playback }: { playback: ContinuousPlaybackState }) {
  const position = getItemPosition(playback);
  const visible = isItemVisible(playback);
  const category = playback.targetCategory;
  
  // Get item data for sizing
  const currentCase = playback.currentCase;
  const itemId = currentCase.itemId.replace('-LC', ''); // Handle low confidence variant
  const itemData = useMemo(() => {
    try {
      return ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
    } catch {
      return ITEMS[0];
    }
  }, [itemId]);
  
  const asset = getModelAsset(itemId);
  
  // Scale based on item dimensions (visual scale for demo)
  const dims = itemData.dimensionsMm;
  const scale = Math.min(0.4, Math.max(0.15, Math.max(dims.width, dims.depth, dims.height) / 800));
  
  // Color based on category
  const colors: Record<Category, string> = {
    B: '#4ade80',
    C: '#f59e0b',
    D: '#c084fc',
  };
  const color = category ? colors[category] : '#38bdf8';
  const isRouting = isRoutingActive(playback);
  
  if (!visible) return null;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Item mesh - use fallback primitive */}
      {asset?.fallbackPrimitive === 'cylinder' ? (
        <mesh>
          <cylinderGeometry args={[scale * 0.5, scale * 0.5, scale * 0.8, 16]} />
          <meshStandardMaterial 
            color={color}
            emissive={color}
            emissiveIntensity={isRouting ? 0.4 : 0.2}
          />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[scale, scale * 0.7, scale]} />
          <meshStandardMaterial 
            color={color}
            emissive={color}
            emissiveIntensity={isRouting ? 0.4 : 0.2}
          />
        </mesh>
      )}
      {/* Glow ring */}
      <mesh position={[0, -scale * 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.4, scale * 0.6, 24]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={isRouting ? 0.6 : 0.3}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

/** Main continuous scene. */
function ContinuousScene({ playback, simplified }: { playback: ContinuousPlaybackState; simplified: boolean }) {
  const speedFactor = getConveyorSpeedFactor(playback);
  const detectionActive = isDetectionActive(playback);
  const activeRoute = getActiveRoute(playback);
  const category = playback.targetCategory;

  return (
    <>
      <color attach="background" args={['#0a1520']} />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.0} />
      <directionalLight position={[-4, 4, -2]} intensity={0.3} />
      <hemisphereLight args={['#b8d4e8', '#1a2836', 0.25]} />

      <Grid
        args={[16, 16]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#2a4a6a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#3a6080"
        fadeDistance={14}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0f1a2a" />
      </mesh>

      {/* Conveyor */}
      <ConveyorBelt speedFactor={speedFactor} />

      {/* Zones */}
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.spawnX, 0.01, 0]} 
        label="A" 
        color="#38bdf8" 
        active={playback.currentPhase === 'spawn'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.zoneBX, 0.01, 0]} 
        label="B" 
        color="#4ade80" 
        active={activeRoute === 'B'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.gateX + 0.8, 0.01, CONVEYOR_POSITIONS.zoneCZ]} 
        label="C" 
        color="#f59e0b" 
        active={activeRoute === 'C'}
      />
      <ZoneMarker 
        position={[CONVEYOR_POSITIONS.gateX + 0.8, 0.01, CONVEYOR_POSITIONS.zoneDZ]} 
        label="D" 
        color="#c084fc" 
        active={activeRoute === 'D'}
      />

      {/* Detection zone */}
      <DetectionZone active={detectionActive} />

      {/* Gate */}
      <GateZone category={category} />

      {/* Route arrows */}
      <RouteArrows activeRoute={activeRoute} />

      {/* Item */}
      <PlaybackItem playback={playback} />

      <OrbitControls
        enablePan={!simplified}
        enableZoom
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={12}
        target={[0.5, 0.4, 0]}
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
