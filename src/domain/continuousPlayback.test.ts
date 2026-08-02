/**
 * Continuous Playback Engine tests + playlist ↔ classifier consistency.
 */

import { describe, it, expect } from 'vitest';
import {
  createPlaybackState,
  startPlayback,
  pausePlayback,
  resumePlayback,
  stopPlayback,
  updatePlayback,
  seekToCase,
  setPlaybackSpeed,
  CASE_DURATION_MS,
  assertPlaylistClassifierConsistency,
  type ContinuousPlaybackState,
} from './continuousPlayback';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from './demoPlaylist';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';

describe('demoPlaylist', () => {
  it('has classification + safety cases', () => {
    expect(PLAYLIST_LENGTH).toBe(12);
    expect(DEMO_PLAYLIST.length).toBe(12);
  });

  it('has no duplicate case ids', () => {
    const ids = DEMO_PLAYLIST.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all non-fault cases match live classifyItem', () => {
    const mismatches = assertPlaylistClassifierConsistency();
    expect(mismatches).toEqual([]);
  });

  it('low_confidence case has warning but category from rules', () => {
    const lowConfidence = DEMO_PLAYLIST.find((c) => c.id === 'low_confidence');
    expect(lowConfidence).toBeDefined();
    expect(lowConfidence!.warning).toBeDefined();
    const result = classifyItem(resolveItem(lowConfidence!.itemId));
    expect(result.category).toBe('B');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('includes jam and emergency_stop safety cases', () => {
    expect(DEMO_PLAYLIST.some((c) => c.faultType === 'jam')).toBe(true);
    expect(DEMO_PLAYLIST.some((c) => c.faultType === 'emergency_stop')).toBe(true);
  });
});

describe('continuousPlayback', () => {
  it('creates initial state with idle status', () => {
    const state = createPlaybackState();
    expect(state.status).toBe('idle');
    expect(state.currentCaseIndex).toBe(0);
  });

  it('startPlayback sets status to running without preassigned route', () => {
    const state = startPlayback(createPlaybackState());
    expect(state.status).toBe('running');
    expect(state.classification).toBeNull();
    expect(state.targetCategory).toBeNull();
  });

  it('pausePlayback sets status to paused', () => {
    let state = startPlayback(createPlaybackState());
    state = pausePlayback(state);
    expect(state.status).toBe('paused');
  });

  it('resumePlayback sets status back to running', () => {
    let state = startPlayback(createPlaybackState());
    state = pausePlayback(state);
    state = resumePlayback(state);
    expect(state.status).toBe('running');
  });

  it('stopPlayback resets to idle', () => {
    let state = startPlayback(createPlaybackState());
    state = stopPlayback(state);
    expect(state.status).toBe('idle');
  });

  it('advances to next case after case duration', () => {
    let state = startPlayback(createPlaybackState());
    let totalTime = 0;
    while (totalTime < CASE_DURATION_MS * 1.5 && state.currentCaseIndex === 0) {
      state = updatePlayback(state, 100);
      totalTime += 100;
    }
    expect(state.currentCaseIndex).toBeGreaterThanOrEqual(1);
  });

  it('seekToCase jumps to jam case and sets FAULT command later', () => {
    const jamIndex = DEMO_PLAYLIST.findIndex((c) => c.faultType === 'jam');
    let state = seekToCase(createPlaybackState(), jamIndex);
    expect(state.currentCase.faultType).toBe('jam');
    for (let i = 0; i < 80; i++) {
      state = updatePlayback(state, 100);
      if (state.command === 'FAULT') break;
    }
    expect(state.command).toBe('FAULT');
  });

  it('setPlaybackSpeed changes multiplier', () => {
    let state = startPlayback(createPlaybackState());
    state = setPlaybackSpeed(state, 2);
    expect(state.speed).toBe(2);
  });

  it('records classification events in journal', () => {
    let state = startPlayback(createPlaybackState());
    for (let i = 0; i < 60; i++) {
      state = updatePlayback(state, 100);
    }
    expect(state.events.some((e) => e.type === 'classification' || e.type === 'system')).toBe(true);
  });

  it('completes playlist', () => {
    let state = startPlayback(createPlaybackState());
    const maxTime = CASE_DURATION_MS * 20;
    let elapsed = 0;
    while (state.status === 'running' && elapsed < maxTime) {
      state = updatePlayback(state, 200);
      elapsed += 200;
    }
    expect(state.status).toBe('finished');
  });
});
