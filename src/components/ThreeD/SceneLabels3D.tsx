import { Html } from '@react-three/drei';
import type { Category, MachineState, SimulatedItem } from '../../domain/types';
import { ROUTE_COLORS, TWIN_LAYOUT } from './itemMotion';
import { OFFICIAL_RULE_LABELS } from '../../domain/classifier';

interface Props {
  machineState: MachineState;
  currentItem?: SimulatedItem;
  simplified?: boolean;
  conveyorTargetMps?: number;
  technicalLabelsEnabled?: boolean;
  cleanView?: boolean;
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

// ItemProofPanel removed — info now displayed in 2D proof card only

export default function SceneLabels3D({
  machineState,
  currentItem,
  conveyorTargetMps = 1,
  technicalLabelsEnabled = false,
  cleanView = true,
}: Props) {
  const category = currentItem?.classification.category as Category | undefined;
  const cage = TWIN_LAYOUT.rollCageSize;
  const beltY = TWIN_LAYOUT.beltY;
  const detecting = machineState === 'DETECTING';
  const atGate = machineState === 'WAITING_AT_GATE' || machineState === 'CLASSIFYING';
  const routing = machineState.startsWith('ROUTE_TO_');
  const fault = machineState === 'FAULT' || machineState === 'EMERGENCY_STOP';
  
  // C-priority: dimensions failed + round detected → only C active, D not active
  const isCPriority = Boolean(
    category === 'C' && currentItem && !currentItem.classification.dimensionsPass && !currentItem.classification.roundnessPass
  );

  return (
    <group>
      {/* === CLEAN VIEW (always visible) === */}
      
      {/* Zones A/B/C/D — always visible */}
      <Badge position={[TWIN_LAYOUT.startX, beltY + 0.15, 0]} text="A" color="#38bdf8" large />
      <Badge position={[TWIN_LAYOUT.zoneBX, beltY + 0.25, 0]} text="B" color={ROUTE_COLORS.B} large />
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

      {/* Накопитель — only in technical mode (убран из clean view) */}
      {technicalLabelsEnabled && (
        <Badge
          position={[TWIN_LAYOUT.accumulatorX, beltY + 0.25, 0.65]}
          text="Накопитель"
          color="#5eead4"
        />
      )}

      {/* === STEP-BASED LABELS (shown only when active) === */}
      
      {/* Detection: Camera/CV + Laser */}
      {detecting && (
        <>
          <Badge position={[TWIN_LAYOUT.cameraX, beltY + 0.5, -0.55]} text="Camera CV" color="#38bdf8" />
          <Badge position={[TWIN_LAYOUT.laserX, beltY + 0.5, -0.55]} text="Laser" color="#22d3ee" />
        </>
      )}

      {/* At gate: Stop-gate + Ultrasonic */}
      {atGate && (
        <>
          <Badge position={[TWIN_LAYOUT.gateX, beltY + 0.45, 0]} text="Stop-gate" color="#fda4af" />
        </>
      )}

      {/* Routing: active pusher only */}
      {routing && category === 'C' && (
        <Badge position={[TWIN_LAYOUT.gateX - 0.1, beltY + 0.05, 0.75]} text="Pusher C" color={ROUTE_COLORS.C} />
      )}
      {routing && category === 'D' && (
        <Badge position={[TWIN_LAYOUT.gateX - 0.1, beltY + 0.05, -0.75]} text="Pusher D" color={ROUTE_COLORS.D} />
      )}

      {/* Active route only (not all three routes) */}
      {routing && category === 'B' && (
        <Badge position={[(TWIN_LAYOUT.gateX + TWIN_LAYOUT.zoneBX) / 2, beltY + 0.05, 0]} text="→ B" color={ROUTE_COLORS.B} />
      )}
      {routing && category === 'C' && (
        <Badge
          position={[TWIN_LAYOUT.gateX + 0.2, beltY + 0.05, TWIN_LAYOUT.zoneCZ / 2]}
          text="→ C"
          color={ROUTE_COLORS.C}
        />
      )}
      {routing && category === 'D' && (
        <Badge
          position={[TWIN_LAYOUT.gateX + 0.2, beltY + 0.05, TWIN_LAYOUT.zoneDZ / 2]}
          text="→ D"
          color={ROUTE_COLORS.D}
        />
      )}

      {/* C-priority badge (only when applicable) */}
      {isCPriority && (
        <Badge
          position={[TWIN_LAYOUT.gateX + 0.4, cage.y + 0.7, TWIN_LAYOUT.zoneCZ]}
          text="C-priority"
          color={ROUTE_COLORS.C}
          large
        />
      )}

      {/* Fault / Emergency stop */}
      {fault && (
        <Badge position={[0, beltY + 1.8, 0]} text={machineState} color="#fb3d4e" large />
      )}

      {/* === TECHNICAL LABELS (opt-in) === */}
      {technicalLabelsEnabled && !cleanView && (
        <>
          {/* Always show all sensors when technical mode is on */}
          {!detecting && <Badge position={[TWIN_LAYOUT.cameraX, beltY + 0.5, -0.55]} text="Camera CV" color="#38bdf8" />}
          {!detecting && <Badge position={[TWIN_LAYOUT.laserX, beltY + 0.5, -0.55]} text="Laser" color="#22d3ee" />}
          <Badge position={[TWIN_LAYOUT.ultrasonicX, beltY + 0.35, -0.55]} text="Ultrasonic" color="#67e8f9" />
          
          {/* Always show all actuators */}
          {!atGate && <Badge position={[TWIN_LAYOUT.gateX, beltY + 0.45, 0]} text="Stop-gate" color="#fda4af" />}
          {!(routing && category === 'C') && (
            <Badge position={[TWIN_LAYOUT.gateX - 0.1, beltY + 0.05, 0.75]} text="Pusher C" color={ROUTE_COLORS.C} />
          )}
          {!(routing && category === 'D') && (
            <Badge position={[TWIN_LAYOUT.gateX - 0.1, beltY + 0.05, -0.75]} text="Pusher D" color={ROUTE_COLORS.D} />
          )}
          
          {/* All route beams */}
          {!(routing && category === 'B') && (
            <Badge position={[(TWIN_LAYOUT.gateX + TWIN_LAYOUT.zoneBX) / 2, beltY + 0.05, 0]} text="Route B" color={ROUTE_COLORS.B} />
          )}
          {!(routing && category === 'C') && (
            <Badge
              position={[TWIN_LAYOUT.gateX + 0.2, beltY + 0.05, TWIN_LAYOUT.zoneCZ / 2]}
              text="Route C"
              color={ROUTE_COLORS.C}
            />
          )}
          {!(routing && category === 'D') && (
            <Badge
              position={[TWIN_LAYOUT.gateX + 0.2, beltY + 0.05, TWIN_LAYOUT.zoneDZ / 2]}
              text="Route D"
              color={ROUTE_COLORS.D}
            />
          )}
          
          {/* Conveyor info */}
          <Badge
            position={[-3.2, beltY + 0.85, 1.4]}
            text={`Conveyor ${conveyorTargetMps.toFixed(2)} m/s · ${OFFICIAL_RULE_LABELS.minDisplay}`}
            color="#91a4b8"
          />
        </>
      )}
    </group>
  );
}
