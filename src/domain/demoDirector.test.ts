import { describe, it, expect } from 'vitest';
import {
  DemoStep,
  createDemoDirectorState,
  startAutoDemo,
  pauseAutoDemo,
  resumeAutoDemo,
  stopAutoDemo,
  updateAutoDemo,
  getDemoStepSequence,
  getDemoStepConfig,
  setPlaybackSpeed,
  toggleLoopMode,
} from './demoDirector';
import type { Scenario } from './types';

import { ITEMS } from '../data/items';

const mockScenario: Scenario = {
  id: 'normal_flow',
  name: 'Normal Flow',
  description: 'Test scenario',
  goal: 'Test auto demo',
  expectedCategorySummary: 'B',
  demonstrates: 'Demo director test',
  items: [ITEMS[0]],
};

describe('demoDirector', () => {
  describe('createDemoDirectorState', () => {
    it('should create initial state', () => {
      const state = createDemoDirectorState(mockScenario);
      expect(state.isAutoDemoRunning).toBe(false);
      expect(state.currentStep).toBe(DemoStep.intro);
      expect(state.stepElapsedMs).toBe(0);
      expect(state.totalElapsedMs).toBe(0);
      expect(state.playbackSpeed).toBe(1);
      expect(state.loopMode).toBe(false);
      expect(state.paused).toBe(false);
    });
  });

  describe('startAutoDemo', () => {
    it('should start auto demo from intro', () => {
      const initial = createDemoDirectorState(mockScenario);
      const started = startAutoDemo(initial);
      expect(started.isAutoDemoRunning).toBe(true);
      expect(started.currentStep).toBe(DemoStep.intro);
      expect(started.paused).toBe(false);
    });
  });

  describe('pauseAutoDemo', () => {
    it('should pause running demo', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = pauseAutoDemo(state);
      expect(state.paused).toBe(true);
      expect(state.isAutoDemoRunning).toBe(true);
    });
  });

  describe('resumeAutoDemo', () => {
    it('should resume paused demo', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = pauseAutoDemo(state);
      state = resumeAutoDemo(state);
      expect(state.paused).toBe(false);
      expect(state.isAutoDemoRunning).toBe(true);
    });
  });

  describe('stopAutoDemo', () => {
    it('should stop demo and reset to intro', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = stopAutoDemo(state);
      expect(state.isAutoDemoRunning).toBe(false);
      expect(state.paused).toBe(false);
      expect(state.currentStep).toBe(DemoStep.intro);
    });
  });

  describe('updateAutoDemo', () => {
    it('should not update if not running', () => {
      const state = createDemoDirectorState(mockScenario);
      const updated = updateAutoDemo(state, 100);
      expect(updated.stepElapsedMs).toBe(0);
    });

    it('should not update if paused', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = pauseAutoDemo(state);
      const updated = updateAutoDemo(state, 100);
      expect(updated.stepElapsedMs).toBe(0);
    });

    it('should increment elapsed time', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      const updated = updateAutoDemo(state, 100);
      expect(updated.stepElapsedMs).toBe(100);
      expect(updated.totalElapsedMs).toBe(100);
    });

    it('should transition to next step when duration exceeded', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      const config = getDemoStepConfig(DemoStep.intro);
      const updated = updateAutoDemo(state, config.durationMs + 100);
      expect(updated.currentStep).toBe(DemoStep.spawn_item);
      expect(updated.stepElapsedMs).toBe(0);
    });

    it('should stop demo when all steps completed (no loop)', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = { ...state, currentStep: DemoStep.reset_or_next };
      const config = getDemoStepConfig(DemoStep.reset_or_next);
      const updated = updateAutoDemo(state, config.durationMs + 100);
      expect(updated.isAutoDemoRunning).toBe(false);
    });

    it('should restart demo when all steps completed (loop mode)', () => {
      let state = createDemoDirectorState(mockScenario);
      state = startAutoDemo(state);
      state = toggleLoopMode(state);
      state = { ...state, currentStep: DemoStep.reset_or_next };
      const config = getDemoStepConfig(DemoStep.reset_or_next);
      const updated = updateAutoDemo(state, config.durationMs + 100);
      expect(updated.currentStep).toBe(DemoStep.intro);
      expect(updated.isAutoDemoRunning).toBe(true);
    });
  });

  describe('getDemoStepSequence', () => {
    it('should contain all key steps in order', () => {
      const sequence = getDemoStepSequence();
      expect(sequence).toContain(DemoStep.intro);
      expect(sequence).toContain(DemoStep.spawn_item);
      expect(sequence).toContain(DemoStep.detection_scan);
      expect(sequence).toContain(DemoStep.dimensions_check);
      expect(sequence).toContain(DemoStep.roundness_check);
      expect(sequence).toContain(DemoStep.decision);
      expect(sequence).toContain(DemoStep.command_sent);
      expect(sequence).toContain(DemoStep.actuator_move);
      expect(sequence).toContain(DemoStep.route_item);
      expect(sequence).toContain(DemoStep.result);
      
      // Verify order: command_sent must come before actuator_move
      const commandIndex = sequence.indexOf(DemoStep.command_sent);
      const actuatorIndex = sequence.indexOf(DemoStep.actuator_move);
      expect(commandIndex).toBeLessThan(actuatorIndex);
      
      // Verify order: actuator_move must come before route_item
      const routeIndex = sequence.indexOf(DemoStep.route_item);
      expect(actuatorIndex).toBeLessThan(routeIndex);
    });
  });

  describe('getDemoStepConfig', () => {
    it('should return config for each step', () => {
      const config = getDemoStepConfig(DemoStep.detection_scan);
      expect(config.step).toBe(DemoStep.detection_scan);
      expect(config.durationMs).toBeGreaterThan(0);
      expect(config.label).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.cameraPreset).toBeDefined();
      expect(config.activeLabels).toBeInstanceOf(Array);
    });
    
    it('should use category for routing steps', () => {
      const configC = getDemoStepConfig(DemoStep.route_item, 'C');
      expect(configC.activeLabels).toContain('C');
      
      const configD = getDemoStepConfig(DemoStep.route_item, 'D');
      expect(configD.activeLabels).toContain('D');
    });
  });

  describe('setPlaybackSpeed', () => {
    it('should set playback speed', () => {
      const state = createDemoDirectorState(mockScenario);
      const updated = setPlaybackSpeed(state, 2);
      expect(updated.playbackSpeed).toBe(2);
    });
  });

  describe('toggleLoopMode', () => {
    it('should toggle loop mode', () => {
      const state = createDemoDirectorState(mockScenario);
      expect(state.loopMode).toBe(false);
      const toggled = toggleLoopMode(state);
      expect(toggled.loopMode).toBe(true);
      const toggledAgain = toggleLoopMode(toggled);
      expect(toggledAgain.loopMode).toBe(false);
    });
  });
});
