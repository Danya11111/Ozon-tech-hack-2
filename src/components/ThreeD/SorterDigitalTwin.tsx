import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { Suspense, useRef, useState } from 'react';
import type { SimulationState } from '../../domain/types';
import Conveyor3D from './Conveyor3D';
import SensorRig3D from './SensorRig3D';
import Actuator3D from './Actuator3D';
import SortingZones3D from './SortingZones3D';
import Item3D from './Item3D';
import RouteArrows3D from './RouteArrows3D';
import SceneLabels3D from './SceneLabels3D';
import { PHYSICS_ENGINE_ENABLED } from './itemMotion';
import { NOMINAL_CONVEYOR_SPEED_MPS } from '../../domain/simulation';
import { DIMENSION_LIMITS } from '../../domain/classifier';

export interface SorterDigitalTwinProps {
  simulation: SimulationState;
  simplified?: boolean;
  showFps?: boolean;
  technicalLabelsEnabled?: boolean;
  cleanView?: boolean;
  onContextLost?: () => void;
}

function FpsMeter({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef<number[]>([]);
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (dt <= 0) return;
    frames.current.push(1000 / dt);
    if (frames.current.length > 45) frames.current.shift();
    const avg = frames.current.reduce((a, b) => a + b, 0) / frames.current.length;
    onFps(Math.round(avg));
  });

  return null;
}

function TwinScene({
  simulation,
  simplified,
  technicalLabelsEnabled,
  cleanView,
  onFps,
}: {
  simulation: SimulationState;
  simplified?: boolean;
  technicalLabelsEnabled?: boolean;
  cleanView?: boolean;
  onFps: (fps: number) => void;
}) {
  const stopped =
    simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
  const category = simulation.currentItem?.classification.category;
  const activeRoute =
    simulation.machineState === 'ROUTE_TO_B'
      ? 'B'
      : simulation.machineState === 'ROUTE_TO_C'
        ? 'C'
        : simulation.machineState === 'ROUTE_TO_D'
          ? 'D'
          : simulation.activeRoute ?? category;

  return (
    <>
      {/* Darker blue-gray background for industrial feel */}
      <color attach="background" args={['#0a1520']} />
      
      {/* Improved lighting for better visibility */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 4]} intensity={1.1} />
      <directionalLight position={[-4, 4, -2]} intensity={0.4} />
      <hemisphereLight args={['#b8d4e8', '#1a2836', 0.3]} />

      <Grid
        args={[16, 16]}
        cellSize={0.5}
        cellThickness={0.7}
        cellColor="#2a4a6a"
        sectionSize={2}
        sectionThickness={1.2}
        sectionColor="#3a6080"
        fadeDistance={16}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Floor with better contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0f1a2a" />
      </mesh>

      <Conveyor3D stopped={stopped} />
      <SensorRig3D sensors={simulation.sensors} machineState={simulation.machineState} />
      <Actuator3D
        gate={simulation.gate}
        actuators={simulation.actuators}
        machineState={simulation.machineState}
      />
      <SortingZones3D activeCategory={category} activeRoute={activeRoute} />
      <RouteArrows3D category={category} machineState={simulation.machineState} />
      <Item3D simulation={simulation} currentItem={simulation.currentItem} />
      <SceneLabels3D
        machineState={simulation.machineState}
        currentItem={simulation.currentItem}
        simplified={simplified}
        conveyorTargetMps={NOMINAL_CONVEYOR_SPEED_MPS}
        technicalLabelsEnabled={technicalLabelsEnabled}
        cleanView={cleanView}
      />

      {stopped ? (
        <mesh position={[0, 1.2, 0]}>
          <planeGeometry args={[6, 1.2]} />
          <meshStandardMaterial color="#7f1d1d" transparent opacity={0.35} />
        </mesh>
      ) : null}

      <OrbitControls
        enablePan={!simplified}
        enableZoom
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2.5}
        maxDistance={10}
        target={[0.6, 0.4, 0]}
      />
      <FpsMeter onFps={onFps} />
    </>
  );
}

export default function SorterDigitalTwin({
  simulation,
  simplified = false,
  showFps = true,
  technicalLabelsEnabled = false,
  cleanView = true,
  onContextLost,
}: SorterDigitalTwinProps) {
  const [fps, setFps] = useState(0);
  const category = simulation.currentItem?.classification.category;
  const command = simulation.machineState.startsWith('ROUTE_TO_')
    ? simulation.machineState
    : category
      ? `ROUTE_TO_${category}`
      : 'IDLE';

  return (
    <div className={`digital-twin-wrap ${simplified ? 'digital-twin-simplified' : ''}`}>
      <div className="digital-twin-hud" aria-live="polite">
        <span className="twin-chip">{simulation.machineState}</span>
        <span className="twin-chip">{simulation.scenario.name}</span>
        {category ? <span className={`twin-chip category-${category}`}>Zone {category}</span> : null}
        <span className="twin-chip">{command}</span>
        <span className="twin-chip">Conveyor {NOMINAL_CONVEYOR_SPEED_MPS.toFixed(2)} m/s</span>
        <span className="twin-chip">
          Min {DIMENSION_LIMITS.min.width}×{DIMENSION_LIMITS.min.depth}×{DIMENSION_LIMITS.min.height} mm
        </span>
        {showFps ? <span className="twin-chip">FPS ~{fps}</span> : null}
        <span className="twin-chip muted-chip">
          Motion: {PHYSICS_ENGINE_ENABLED ? 'physics' : 'state-machine'}
        </span>
      </div>

      <div className="digital-twin-canvas">
        <Canvas
          camera={{ position: simplified ? [3.8, 2.6, 3.8] : [4.0, 3.0, 4.0], fov: 45 }}
          dpr={simplified ? [1, 1.25] : [1, 1.75]}
          gl={{ antialias: !simplified, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const handleLost = (event: Event) => {
              event.preventDefault();
              // Ignore teardown when switching to 2D / unmounting the canvas.
              if (!canvas.isConnected) return;
              onContextLost?.();
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
          }}
        >
          <Suspense fallback={null}>
            <TwinScene 
              simulation={simulation} 
              simplified={simplified} 
              technicalLabelsEnabled={technicalLabelsEnabled}
              cleanView={cleanView}
              onFps={setFps} 
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
