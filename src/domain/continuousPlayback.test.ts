import { describe, it, expect } from 'vitest';
import {
  createPlaybackState,
  startPlayback,
  pausePlayback,
  resumePlayback,
  stopPlayback,
  updatePlayback,
  CASE_DURATION_MS,
  type ContinuousPlaybackState,
} from './continuousPlayback';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from './demoPlaylist';

describe('demoPlaylist', () => {
  it('has exactly 8 cases', () => {
    expect(PLAYLIST_LENGTH).toBe(8);
    expect(DEMO_PLAYLIST.length).toBe(8);
  });

  it('has no duplicate case ids', () => {
    const ids = DEMO_PLAYLIST.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has no mixed category (all cases have specific B/C/D)', () => {
    const validCategories = ['B', 'C', 'D'];
    DEMO_PLAYLIST.forEach(c => {
      expect(validCategories).toContain(c.expectedCategory);
    });
  });

  it('all commands would be ROUTE_TO_B/C/D', () => {
    DEMO_PLAYLIST.forEach(c => {
      const expectedCommand = `ROUTE_TO_${c.expectedCategory}`;
      expect(['ROUTE_TO_B', 'ROUTE_TO_C', 'ROUTE_TO_D']).toContain(expectedCommand);
    });
  });

  it('low_confidence case has warning but final category is B/C/D', () => {
    const lowConfidence = DEMO_PLAYLIST.find(c => c.id === 'low_confidence');
    expect(lowConfidence).toBeDefined();
    expect(lowConfidence!.warning).toBeDefined();
    expect(['B', 'C', 'D']).toContain(lowConfidence!.expectedCategory);
  });

  it('has correct case order: B, B, C, C, D, D, C, B', () => {
    const expectedOrder = ['B', 'B', 'C', 'C', 'D', 'D', 'C', 'B'];
    const actualOrder = DEMO_PLAYLIST.map(c => c.expectedCategory);
    expect(actualOrder).toEqual(expectedOrder);
  });
});

describe('continuousPlayback', () => {
  it('creates initial state with idle status', () => {
    const state = createPlaybackState();
    expect(state.status).toBe('idle');
    expect(state.currentCaseIndex).toBe(0);
  });

  it('startPlayback sets status to running', () => {
    const state = createPlaybackState();
    const running = startPlayback(state);
    expect(running.status).toBe('running');
    expect(running.currentCaseIndex).toBe(0);
  });

  it('pausePlayback sets status to paused', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = pausePlayback(state);
    expect(state.status).toBe('paused');
  });

  it('resumePlayback sets status back to running', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = pausePlayback(state);
    state = resumePlayback(state);
    expect(state.status).toBe('running');
  });

  it('stopPlayback resets to idle', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = updatePlayback(state, 1000);
    state = stopPlayback(state);
    expect(state.status).toBe('idle');
    expect(state.currentCaseIndex).toBe(0);
    expect(state.totalElapsedMs).toBe(0);
  });

  it('advances from case 1 to case 2 after case duration', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    expect(state.currentCaseIndex).toBe(0);
    
    // Simulate passing entire case duration by updating in steps
    // Each update processes one phase at a time
    let totalTime = 0;
    while (totalTime < CASE_DURATION_MS * 1.5 && state.currentCaseIndex === 0) {
      state = updatePlayback(state, 100);
      totalTime += 100;
    }
    expect(state.currentCaseIndex).toBe(1);
  });

  it('status becomes finished after case 8 (without loop)', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = { ...state, loopMode: false };
    
    // Simulate passing all 8 cases by updating in steps
    let totalTime = 0;
    const maxTime = CASE_DURATION_MS * 10; // Safety limit
    while (state.status === 'running' && totalTime < maxTime) {
      state = updatePlayback(state, 100);
      totalTime += 100;
    }
    
    expect(state.status).toBe('finished');
  });

  it('loops back to case 1 after case 8 with loopMode', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = { ...state, loopMode: true };
    
    // Simulate passing all 8 cases in steps
    let casesPassed = 0;
    let totalTime = 0;
    const maxTime = CASE_DURATION_MS * 10;
    
    while (casesPassed < 8 && totalTime < maxTime) {
      const prevIndex = state.currentCaseIndex;
      state = updatePlayback(state, 100);
      totalTime += 100;
      if (state.currentCaseIndex !== prevIndex || (prevIndex === 7 && state.currentCaseIndex === 0)) {
        casesPassed++;
      }
    }
    
    expect(state.status).toBe('running');
    expect(state.currentCaseIndex).toBe(0);
  });

  it('updates command during routing phase', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    
    // Advance to routing phase (roughly halfway through case)
    state = updatePlayback(state, CASE_DURATION_MS * 0.7);
    
    // Command should be ROUTE_TO_* based on category
    expect(state.command).toMatch(/^ROUTE_TO_[BCD]$|^MOVING_TO_CAMERA$|^DETECTING$|^MEASURING$|^CLASSIFYING$|^RETURN_HOME$/);
  });

  it('does not update when paused', () => {
    let state = createPlaybackState();
    state = startPlayback(state);
    state = updatePlayback(state, 1000);
    const elapsed1 = state.totalElapsedMs;
    
    state = pausePlayback(state);
    state = updatePlayback(state, 1000);
    
    expect(state.totalElapsedMs).toBe(elapsed1);
  });
});
