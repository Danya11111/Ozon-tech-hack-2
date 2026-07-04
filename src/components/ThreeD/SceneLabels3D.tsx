import { Html } from '@react-three/drei';
import type { Category, MachineState, SimulatedItem } from '../../domain/types';
import { TWIN_LAYOUT } from './itemMotion';

interface Props {
  machineState: MachineState;
  currentItem?: SimulatedItem;
  simplified?: boolean;
}

function Badge({
  position,
  text,
  color = '#e5f2ff',
}: {
  position: [number, number, number];
  text: string;
  color?: string;
}) {
  return (
    <Html position={position} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          padding: '4px 8px',
          borderRadius: 8,
          background: 'rgba(5, 9, 16, 0.82)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          color,
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

export default function SceneLabels3D({ machineState, currentItem, simplified }: Props) {
  const category = currentItem?.classification.category as Category | undefined;
  const item = currentItem?.item;
  const result = currentItem?.classification;
  const command = machineState.startsWith('ROUTE_TO_')
    ? machineState
    : category
      ? `ROUTE_TO_${category}`
      : null;

  return (
    <group>
      <Badge position={[TWIN_LAYOUT.startX, 0.7, 0]} text="A feed" color="#7dd3fc" />
      <Badge position={[TWIN_LAYOUT.cameraX, 1.15, -0.55]} text="Camera / CV" color="#38bdf8" />
      {!simplified ? (
        <>
          <Badge position={[TWIN_LAYOUT.laserX, 1.15, -0.55]} text="Laser" color="#22d3ee" />
          <Badge position={[TWIN_LAYOUT.ultrasonicX, 1.0, -0.55]} text="Ultrasonic" color="#67e8f9" />
        </>
      ) : null}
      <Badge position={[TWIN_LAYOUT.accumulatorX, 0.85, 0.55]} text="Накопитель" color="#5eead4" />
      <Badge position={[TWIN_LAYOUT.gateX, 1.0, 0]} text="Stop-gate" color="#fda4af" />
      <Badge position={[TWIN_LAYOUT.zoneBX, 0.9, 0]} text="B" color="#4ade80" />
      <Badge position={[TWIN_LAYOUT.gateX + 0.4, 1.0, TWIN_LAYOUT.zoneCZ]} text="C roll-cage" color="#f59e0b" />
      <Badge position={[TWIN_LAYOUT.gateX + 0.4, 1.0, TWIN_LAYOUT.zoneDZ]} text="D roll-cage" color="#c084fc" />

      {item && result && !simplified ? (
        <Badge
          position={[0, 1.6, 0]}
          text={`${item.dimensionsMm.width}×${item.dimensionsMm.depth}×${item.dimensionsMm.height} · K=${item.roundness.toFixed(2)} · ${result.dimensionsPass ? 'DIM PASS' : 'DIM FAIL'} · ${category}`}
          color={category === 'B' ? '#4ade80' : category === 'C' ? '#f59e0b' : '#c084fc'}
        />
      ) : null}

      {command ? (
        <Badge
          position={[TWIN_LAYOUT.gateX + 1.2, 1.35, 0]}
          text={command}
          color={category === 'B' ? '#4ade80' : category === 'C' ? '#f59e0b' : '#c084fc'}
        />
      ) : null}

      {machineState === 'DETECTING' ? (
        <Badge position={[TWIN_LAYOUT.cameraX, 1.45, 0]} text="CV detection" color="#38bdf8" />
      ) : null}

      {machineState === 'FAULT' || machineState === 'EMERGENCY_STOP' ? (
        <Badge position={[0, 1.8, 0]} text={machineState} color="#fb3d4e" />
      ) : null}
    </group>
  );
}
