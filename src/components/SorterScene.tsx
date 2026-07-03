import type { Category, MachineState, SimulationState } from '../domain/types';

const routeColors: Record<Category, string> = {
  B: '#4ade80',
  C: '#f59e0b',
  D: '#c084fc',
};

function progressForState(state: MachineState, elapsedMs: number): number {
  const ratios: Partial<Record<MachineState, [number, number, number]>> = {
    MOVING_TO_CAMERA: [0.08, 0.34, 1200],
    DETECTING: [0.34, 0.36, 900],
    MOVING_TO_GATE: [0.36, 0.64, 1300],
    WAITING_AT_GATE: [0.64, 0.65, 800],
    CLASSIFYING: [0.65, 0.66, 700],
    ROUTE_TO_B: [0.66, 0.92, 1200],
    ROUTE_TO_C: [0.66, 0.82, 1200],
    ROUTE_TO_D: [0.66, 0.82, 1200],
    RETURN_HOME: [0.92, 0.94, 700],
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
  const baseX = 120 + progress * 760;
  const beltY = 315;

  if (simulation.machineState === 'ROUTE_TO_C') {
    return { x: baseX, y: beltY + Math.min(simulation.elapsedInStateMs / 1200, 1) * 150 };
  }

  if (simulation.machineState === 'ROUTE_TO_D') {
    return { x: baseX, y: beltY - Math.min(simulation.elapsedInStateMs / 1200, 1) * 150 };
  }

  return { x: baseX, y: beltY };
}

export default function SorterScene({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;
  const category = current?.classification.category;
  const color = category ? routeColors[category] : '#38bdf8';
  const position = itemPosition(simulation);
  const detecting = simulation.machineState === 'DETECTING';
  const routeVisible = simulation.machineState.startsWith('ROUTE_TO_');

  return (
    <div className="scene-wrap">
      <div className="scene-title-row">
        <div>
          <p className="eyebrow">Work zone 6000 x 10000 mm</p>
          <h2>Sorting line digital twin</h2>
        </div>
        <div className="machine-state-chip">{simulation.machineState}</div>
      </div>
      <svg viewBox="0 0 1000 620" role="img" aria-label="Sorter simulation scene" className="sorter-svg">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#183044" strokeWidth="1" />
          </pattern>
          <marker id="arrowB" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#4ade80" />
          </marker>
          <marker id="arrowC" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#f59e0b" />
          </marker>
          <marker id="arrowD" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#c084fc" />
          </marker>
        </defs>

        <rect x="20" y="20" width="960" height="560" rx="18" fill="#08111d" stroke="#1f3b54" />
        <rect x="40" y="40" width="920" height="520" fill="url(#grid)" opacity="0.75" />

        <g className="zone zone-a">
          <rect x="70" y="246" width="120" height="138" rx="14" />
          <text x="130" y="238">A feed</text>
        </g>
        <g className="zone zone-b">
          <rect x="805" y="246" width="125" height="138" rx="14" />
          <text x="868" y="238">B main sorter</text>
        </g>
        <g className="zone zone-d">
          <rect x="610" y="76" width="190" height="110" rx="14" />
          <text x="705" y="68">D shape / repack</text>
        </g>
        <g className="zone zone-c">
          <rect x="610" y="444" width="190" height="110" rx="14" />
          <text x="705" y="574">C oversize cage</text>
        </g>

        <rect x="90" y="275" width="810" height="80" rx="12" fill="#111f2e" stroke="#38526d" strokeWidth="2" />
        <line x1="110" y1="315" x2="880" y2="315" stroke="#5c7087" strokeWidth="2" strokeDasharray="18 12" />
        {Array.from({ length: 16 }).map((_, index) => (
          <line key={index} x1={125 + index * 48} y1="284" x2={148 + index * 48} y2="346" stroke="#21374c" strokeWidth="3" />
        ))}

        <g className={simulation.sensors.camera.active ? 'device active' : 'device'}>
          <rect x="345" y="188" width="70" height="48" rx="8" />
          <line x1="380" y1="236" x2="380" y2="275" />
          <text x="380" y="180">Camera</text>
        </g>
        <g className={simulation.sensors.laser.active ? 'device active' : 'device'}>
          <rect x="465" y="188" width="70" height="48" rx="8" />
          <line x1="500" y1="236" x2="500" y2="275" />
          <text x="500" y="180">Laser</text>
        </g>
        <g className={simulation.sensors.ultrasound.active ? 'device active' : 'device'}>
          <circle cx="620" cy="215" r="26" />
          <line x1="620" y1="241" x2="620" y2="275" />
          <text x="620" y="180">Ultrasound</text>
        </g>

        <g className={simulation.gate.open ? 'gate open' : 'gate closed'}>
          <line x1="680" y1="258" x2="680" y2="372" />
          <text x="706" y="263">Stop-gate {simulation.gate.open ? 'open' : 'closed'}</text>
        </g>

        <g className={`pusher ${simulation.actuators.pusherC}`}>
          <rect x="600" y="372" width="160" height="32" rx="8" />
          <text x="680" y="426">Pusher C</text>
        </g>
        <g className={`pusher ${simulation.actuators.pusherD}`}>
          <rect x="600" y="226" width="160" height="32" rx="8" />
          <text x="680" y="220">Pusher D</text>
        </g>

        {routeVisible && category === 'B' ? <line x1="690" y1="315" x2="875" y2="315" stroke="#4ade80" strokeWidth="5" markerEnd="url(#arrowB)" /> : null}
        {routeVisible && category === 'C' ? <line x1="690" y1="330" x2="705" y2="485" stroke="#f59e0b" strokeWidth="5" markerEnd="url(#arrowC)" /> : null}
        {routeVisible && category === 'D' ? <line x1="690" y1="300" x2="705" y2="145" stroke="#c084fc" strokeWidth="5" markerEnd="url(#arrowD)" /> : null}

        {current ? (
          <g>
            <rect
              x={position.x - 28}
              y={position.y - 24}
              width="56"
              height="48"
              rx={current.item.shape.includes('round') || current.item.shape.includes('cylinder') ? 24 : 8}
              fill={color}
              opacity="0.92"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text x={position.x} y={position.y + 44} className="item-label">{current.item.id}</text>
            {detecting ? (
              <rect x={position.x - 39} y={position.y - 34} width="78" height="68" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 5" />
            ) : null}
          </g>
        ) : null}

        <text x="80" y="535" className="scale-label">Conveyor width 500 mm / height 700 mm</text>
        <text x="80" y="555" className="scale-label">SVG scene is scaled for operator overview</text>
      </svg>
    </div>
  );
}
