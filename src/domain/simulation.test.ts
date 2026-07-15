import { describe, it, expect } from 'vitest';
import { createSimulation, stepSimulationToNextState, setRunning, stepSimulation } from './simulation';
import { SCENARIOS } from '../data/scenarios';

function scenario(id: string) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`missing scenario ${id}`);
  return s;
}

describe('simulation state machine', () => {
  it('classifies and routes normal item to B/C/D via classifyItem', () => {
    let state = createSimulation(scenario('normal_flow'));
    state = stepSimulationToNextState(state);
    expect(state.machineState).toBe('MOVING_TO_CAMERA');
    expect(state.currentItem).toBeDefined();
    expect(['B', 'C', 'D']).toContain(state.currentItem!.classification.category);
  });

  it('oversized scenario routes to C', () => {
    let state = createSimulation(scenario('oversized_item'));
    state = stepSimulationToNextState(state);
    expect(state.currentItem!.classification.category).toBe('C');
  });

  it('c_priority chooses C over D', () => {
    let state = createSimulation(scenario('c_priority'));
    state = stepSimulationToNextState(state);
    expect(state.currentItem!.classification.category).toBe('C');
    expect(state.currentItem!.item.roundness).toBeGreaterThanOrEqual(0.7);
  });

  it('jam scenario enters FAULT', () => {
    let state = setRunning(createSimulation(scenario('jam')), true);
    state = setRunning(stepSimulationToNextState(state), true);
    for (let i = 0; i < 120; i++) {
      state = stepSimulation(setRunning(state, true), 100);
      if (state.machineState === 'FAULT') break;
    }
    expect(state.machineState).toBe('FAULT');
    expect(state.systemStatus).toBe('FAULT');
  });

  it('emergency_stop freezes system', () => {
    let state = setRunning(createSimulation(scenario('emergency_stop')), true);
    state = stepSimulationToNextState(state);
    for (let i = 0; i < 40; i++) {
      state = stepSimulation(state, 100);
      if (state.machineState === 'EMERGENCY_STOP') break;
    }
    expect(state.machineState).toBe('EMERGENCY_STOP');
    expect(state.systemStatus).toBe('EMERGENCY_STOP');
  });
});
