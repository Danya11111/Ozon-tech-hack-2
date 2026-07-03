import type { Category, MachineState, SimulationState } from '../domain/types';

const routeColors: Record<Category, string> = {
  B: '#4ade80',
  C: '#f59e0b',
  D: '#c084fc',
};

function progressForState(state: MachineState, elapsedMs: number): number {
  const ratios: Partial<Record<MachineState, [number, number, number]>> = {
    MOVING_TO_CAMERA: [0.06, 0.34, 1200],
    DETECTING: [0.34, 0.36, 900],
    MOVING_TO_GATE: [0.36, 0.64, 1300],
    WAITING_AT_GATE: [0.64, 0.65, 800],
    CLASSIFYING: [0.65, 0.66, 700],
    ROUTE_TO_B: [0.66, 0.93, 1200],
    ROUTE_TO_C: [0.66, 0.78, 1200],
    ROUTE_TO_D: [0.66, 0.78, 1200],
    RETURN_HOME: [0.93, 0.94, 700],
  };
  const segment = ratios[state];
  if (!segment) {
    return state === 'IDLE' ? 0 : 0.65;
  }
  const [from, to, duration] = segment;
  return from + (to - from) * Math.min(elapsedMs / duration, 1);
}

function itemPosition(simulation: SimulationState): { x: number; y: number } {
  const progress = progressForState(simulation.machineState, simulation.elapsedInStateMs);
  const baseX = 126 + progress * 790;
  const beltY = 360;

  if (simulation.machineState === 'ROUTE_TO_C') {
    return { x: baseX, y: beltY + Math.min(simulation.elapsedInStateMs / 1200, 1) * 172 };
  }

  if (simulation.machineState === 'ROUTE_TO_D') {
    return { x: baseX, y: beltY - Math.min(simulation.elapsedInStateMs / 1200, 1) * 172 };
  }

  return { x: baseX, y: beltY };
}

function DimensionLine({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2;
  return (
    <g className="dimension-line">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x1} cy={y1} r="3" />
      <circle cx={x2} cy={y2} r="3" />
      <text x={labelX} y={labelY - 8}>{label}</text>
    </g>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <g className="legend-item">
      <rect width="10" height="10" fill={color} rx="2" />
      <text x="16" y="10">{label}</text>
    </g>
  );
}

export default function SorterScene({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;
  const category = current?.classification.category;
  const color = category ? routeColors[category] : '#38bdf8';
  const position = itemPosition(simulation);
  const detecting = simulation.machineState === 'DETECTING';
  const routeVisible = simulation.machineState.startsWith('ROUTE_TO_');
  const stopped = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
  const itemWidth = current ? Math.max(24, Math.min(74, current.item.dimensionsMm.width / 6)) : 56;
  const itemHeight = current ? Math.max(18, Math.min(58, current.item.dimensionsMm.depth / 5.5)) : 48;

  return (
    <div className="scene-wrap">
      <div className="scene-title-row">
        <div>
          <p className="eyebrow">Work zone 6000 x 10000 mm / conveyor 500 mm</p>
          <h2>Engineering layout, sensors and routing commands</h2>
        </div>
        <div className={`machine-state-chip ${stopped ? 'fault-chip' : ''}`}>{simulation.machineState}</div>
      </div>
      <svg viewBox="0 0 1120 720" role="img" aria-label="Sorter simulation scene" className="sorter-svg">
        <defs>
          <pattern id="gridMinor" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#12283b" strokeWidth="1" />
          </pattern>
          <pattern id="gridMajor" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill="url(#gridMinor)" />
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#244863" strokeWidth="1.4" />
          </pattern>
          {(['B', 'C', 'D'] as Category[]).map((route) => (
            <marker key={route} id={`arrow${route}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill={routeColors[route]} />
            </marker>
          ))}
        </defs>

        <rect x="24" y="26" width="1072" height="632" rx="12" fill="#07111d" stroke="#244863" />
        <rect x="64" y="82" width="928" height="520" fill="url(#gridMajor)" opacity="0.9" />
        <text x="78" y="74" className="scale-label left-label">Scaled plan: 6000 mm x 10000 mm work cell</text>

        <DimensionLine x1={64} y1={626} x2={992} y2={626} label="6000 mm work zone width" />
        <DimensionLine x1={1024} y1={82} x2={1024} y2={602} label="10000 mm work zone length" />
        <DimensionLine x1={92} y1={314} x2={92} y2={406} label="500 mm conveyor" />

        <g className="zone zone-a">
          <rect x="88" y="292" width="128" height="136" rx="8" />
          <text x="152" y="282">A feed zone</text>
        </g>
        <g className="zone zone-b">
          <rect x="842" y="292" width="136" height="136" rx="8" />
          <text x="910" y="282">B main sorter</text>
        </g>
        <g className="zone zone-d">
          <rect x="642" y="112" width="210" height="124" rx="8" />
          <text x="747" y="102">D roll-cage 1200 x 800 x 800 mm</text>
        </g>
        <g className="zone zone-c">
          <rect x="642" y="486" width="210" height="124" rx="8" />
          <text x="747" y="632">C roll-cage 1200 x 800 x 800 mm</text>
        </g>

        <rect className={stopped ? 'conveyor stopped' : 'conveyor'} x="106" y="314" width="850" height="92" rx="6" />
        <line x1="126" y1="360" x2="936" y2="360" className="belt-center" />
        {Array.from({ length: 18 }).map((_, index) => (
          <line key={index} x1={132 + index * 44} y1="324" x2={158 + index * 44} y2="396" className="roller-line" />
        ))}

        <g className={simulation.sensors.camera.active ? 'device active' : 'device'}>
          <rect x="350" y="218" width="76" height="50" rx="6" />
          <line x1="388" y1="268" x2="388" y2="314" />
          <text x="388" y="208">Camera / bbox</text>
        </g>
        <g className={simulation.sensors.laser.active ? 'device active' : 'device'}>
          <rect x="474" y="218" width="76" height="50" rx="6" />
          <line x1="512" y1="268" x2="512" y2="314" />
          <text x="512" y="208">Laser height</text>
        </g>
        <g className={simulation.sensors.ultrasound.active ? 'device active' : 'device'}>
          <circle cx="646" cy="243" r="28" />
          <line x1="646" y1="271" x2="646" y2="314" />
          <text x="646" y="208">Ultrasonic gate</text>
        </g>

        <g className={simulation.gate.open ? 'gate open' : 'gate closed'}>
          <line x1="708" y1="296" x2="708" y2="424" />
          <text x="746" y="300">Stop-gate {simulation.gate.open ? 'open' : 'closed'}</text>
        </g>

        <g className={`pusher ${simulation.actuators.pusherC}`}>
          <rect x="625" y="424" width="174" height="34" rx="6" />
          <text x="712" y="476">Pusher C command</text>
        </g>
        <g className={`pusher ${simulation.actuators.pusherD}`}>
          <rect x="625" y="262" width="174" height="34" rx="6" />
          <text x="712" y="256">Pusher D command</text>
        </g>

        <line x1="706" y1="360" x2="928" y2="360" className="route-guide route-b" markerEnd="url(#arrowB)" />
        <line x1="706" y1="376" x2="748" y2="548" className="route-guide route-c" markerEnd="url(#arrowC)" />
        <line x1="706" y1="344" x2="748" y2="174" className="route-guide route-d" markerEnd="url(#arrowD)" />
        {routeVisible && category ? (
          <g className="route-command">
            <rect x="788" y="326" width="156" height="34" rx="8" fill={routeColors[category]} />
            <text x="866" y="348">{simulation.machineState}</text>
          </g>
        ) : null}

        {current ? (
          <g>
            <rect
              x={position.x - itemWidth / 2}
              y={position.y - itemHeight / 2}
              width={itemWidth}
              height={itemHeight}
              rx={current.item.shape.includes('round') || current.item.shape.includes('cylinder') ? Math.min(itemWidth, itemHeight) / 2 : 5}
              fill={color}
              opacity="0.92"
              stroke="#ffffff"
              strokeWidth="1.4"
            />
            <text x={position.x} y={position.y + itemHeight / 2 + 18} className="item-label">{current.item.id}</text>
            {detecting ? (
              <g className="bbox">
                <rect x={position.x - itemWidth / 2 - 10} y={position.y - itemHeight / 2 - 10} width={itemWidth + 20} height={itemHeight + 20} />
                <text x={position.x} y={position.y - itemHeight / 2 - 18}>bbox {current.item.dimensionsMm.width} x {current.item.dimensionsMm.depth} mm</text>
              </g>
            ) : null}
          </g>
        ) : null}

        {stopped ? (
          <g className="fault-overlay">
            <rect x="610" y="286" width="210" height="148" rx="10" />
            <text x="715" y="350">{simulation.machineState}</text>
            <text x="715" y="376">Conveyor stopped, reset required</text>
          </g>
        ) : null}

        <g className="scene-legend" transform="translate(78 664)">
          <LegendItem color="#4ade80" label="B main sorter" />
          <g transform="translate(140 0)"><LegendItem color="#f59e0b" label="C oversize" /></g>
          <g transform="translate(270 0)"><LegendItem color="#c084fc" label="D shape / repack" /></g>
          <g transform="translate(430 0)"><LegendItem color="#38bdf8" label="camera / laser / ultrasonic active" /></g>
          <g transform="translate(700 0)"><LegendItem color="#fb3d4e" label="stop-gate / fault" /></g>
        </g>
      </svg>
    </div>
  );
}
