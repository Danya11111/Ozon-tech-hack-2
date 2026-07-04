import { Html } from '@react-three/drei';
import type { Category, MachineState, SimulatedItem } from '../../domain/types';
import { ROUTE_COLORS, TWIN_LAYOUT } from './itemMotion';

interface Props {
  machineState: MachineState;
  currentItem?: SimulatedItem;
  simplified?: boolean;
  conveyorTargetMps?: number;
}

function Badge({
  position,
  text,
  color = '#e5f2ff',
  large = false,
}: {
  position: [number, number, number];
  text: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <Html position={position} center distanceFactor={large ? 8 : 10} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          padding: large ? '8px 12px' : '4px 8px',
          borderRadius: large ? 12 : 8,
          background: 'rgba(5, 9, 16, 0.9)',
          border: `1px solid ${color}`,
          color,
          fontSize: large ? 15 : 12,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: large ? '0.04em' : undefined,
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function ItemProofPanel({
  currentItem,
  machineState,
}: {
  currentItem: SimulatedItem;
  machineState: MachineState;
}) {
  const item = currentItem.item;
  const result = currentItem.classification;
  const category = result.category as Category;
  const color = ROUTE_COLORS[category];
  const command = machineState.startsWith('ROUTE_TO_')
    ? machineState
    : `ROUTE_TO_${category}`;
  const dims = item.dimensionsMm;
  const dimStatus = result.dimensionsPass ? 'PASS' : 'FAIL';
  const roundStatus = result.roundnessPass ? 'PASS' : 'DETECTED';

  return (
    <Html position={[0, 2.05, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          minWidth: 260,
          padding: '12px 14px',
          borderRadius: 14,
          background: 'rgba(5, 9, 16, 0.94)',
          border: `2px solid ${color}`,
          color: '#e5f2ff',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: `0 0 24px ${color}44`,
        }}
      >
        <div style={{ fontSize: 11, color: '#91a4b8', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Current item
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 10px' }}>{item.name}</div>
        <div style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }}>
          <div>
            Dimensions: {dims.width}×{dims.depth}×{dims.height} mm{' '}
            <span style={{ color: result.dimensionsPass ? '#4ade80' : '#fb3d4e' }}>{dimStatus}</span>
          </div>
          <div>
            Roundness K = {item.roundness.toFixed(2)}{' '}
            <span style={{ color: result.roundnessPass ? '#4ade80' : '#c084fc' }}>{roundStatus}</span>
          </div>
          <div style={{ color }}>
            Category: {category}
          </div>
          <div style={{ color }}>
            Command: {command}
          </div>
          <div style={{ color }}>
            Target zone: {category}
          </div>
        </div>
      </div>
    </Html>
  );
}

export default function SceneLabels3D({
  machineState,
  currentItem,
  conveyorTargetMps = 1,
}: Props) {
  const category = currentItem?.classification.category as Category | undefined;
  const cage = TWIN_LAYOUT.rollCageSize;

  return (
    <group>
      {/* Zones A/B/C/D — always explicit */}
      <Badge position={[TWIN_LAYOUT.startX, 0.85, 0]} text="A" color="#38bdf8" large />
      <Badge position={[TWIN_LAYOUT.zoneBX, 0.95, 0]} text="B" color={ROUTE_COLORS.B} large />
      <Badge
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y + 0.35, TWIN_LAYOUT.zoneCZ]}
        text="C"
        color={ROUTE_COLORS.C}
        large
      />
      <Badge
        position={[TWIN_LAYOUT.gateX + 0.4, cage.y + 0.35, TWIN_LAYOUT.zoneDZ]}
        text="D"
        color={ROUTE_COLORS.D}
        large
      />

      {/* Accumulator at end of feed conveyor */}
      <Badge
        position={[TWIN_LAYOUT.accumulatorX, 0.95, 0.65]}
        text="Накопитель"
        color="#5eead4"
        large
      />

      {/* Sensors & actuators — always visible */}
      <Badge position={[TWIN_LAYOUT.cameraX, 1.2, -0.55]} text="Camera / CV" color="#38bdf8" />
      <Badge position={[TWIN_LAYOUT.laserX, 1.2, -0.55]} text="Laser" color="#22d3ee" />
      <Badge position={[TWIN_LAYOUT.ultrasonicX, 1.05, -0.55]} text="Ultrasonic" color="#67e8f9" />
      <Badge position={[TWIN_LAYOUT.gateX, 1.15, 0]} text="Stop-gate" color="#fda4af" />
      <Badge position={[TWIN_LAYOUT.gateX - 0.1, 0.75, 0.75]} text="Pusher C" color={ROUTE_COLORS.C} />
      <Badge position={[TWIN_LAYOUT.gateX - 0.1, 0.75, -0.75]} text="Pusher D" color={ROUTE_COLORS.D} />

      {/* Route labels */}
      <Badge position={[(TWIN_LAYOUT.gateX + TWIN_LAYOUT.zoneBX) / 2, 0.55, 0]} text="Route B" color={ROUTE_COLORS.B} />
      <Badge
        position={[TWIN_LAYOUT.gateX + 0.2, 0.55, TWIN_LAYOUT.zoneCZ / 2]}
        text="Route C"
        color={ROUTE_COLORS.C}
      />
      <Badge
        position={[TWIN_LAYOUT.gateX + 0.2, 0.55, TWIN_LAYOUT.zoneDZ / 2]}
        text="Route D"
        color={ROUTE_COLORS.D}
      />

      <Badge
        position={[-3.2, 1.55, 1.4]}
        text={`Conveyor ${conveyorTargetMps.toFixed(2)} m/s · min 10×10×10 mm`}
        color="#91a4b8"
      />

      {currentItem ? <ItemProofPanel currentItem={currentItem} machineState={machineState} /> : null}

      {category === 'C' && currentItem && !currentItem.classification.roundnessPass ? (
        <Badge
          position={[TWIN_LAYOUT.gateX + 0.4, cage.y + 0.7, TWIN_LAYOUT.zoneCZ]}
          text="C-priority (dims first)"
          color={ROUTE_COLORS.C}
          large
        />
      ) : null}

      {machineState === 'DETECTING' ? (
        <Badge position={[TWIN_LAYOUT.cameraX, 1.55, 0]} text="CV detection" color="#38bdf8" />
      ) : null}

      {machineState === 'FAULT' || machineState === 'EMERGENCY_STOP' ? (
        <Badge position={[0, 2.5, 0]} text={machineState} color="#fb3d4e" large />
      ) : null}
    </group>
  );
}
