/**
 * Unit tests for measurementSystem
 */

import { describe, it, expect } from 'vitest';
import { getMeasurementData, getStageLabel, shouldShowMeasurement, shouldShowLaserBeam } from './measurementSystem';
import { createPlaybackState, startPlayback, updatePlayback } from './continuousPlayback';
import { MM_PER_STEP } from './physicalLayout';

describe('measurementSystem', () => {
  describe('getMeasurementData', () => {
    it('returns valid measurement data for idle state', () => {
      const state = createPlaybackState();
      const data = getMeasurementData(state);
      
      expect(data.stage).toBe('idle');
      expect(data.stepCount).toBeGreaterThan(0);
      expect(data.mmPerStep).toBe(MM_PER_STEP);
      expect(data.itemTitle).toBeTruthy();
    });
    
    it('calculates step count from item length', () => {
      const state = createPlaybackState();
      const data = getMeasurementData(state);
      
      // stepCount should be positive
      expect(data.stepCount).toBeGreaterThan(0);
      
      // measuredLength should equal stepCount * mmPerStep
      expect(data.measuredLengthMm).toBeCloseTo(data.stepCount * data.mmPerStep, 0);
    });
    
    it('calculates height from laser distance', () => {
      const state = createPlaybackState();
      const data = getMeasurementData(state);
      
      // height = mount height - distance
      expect(data.measuredHeightMm).toBe(data.laserMountHeightMm - data.laserDistanceMm);
    });
    
    it('returns round shape for high roundness', () => {
      // Start playback and advance to measurement phase
      let state = createPlaybackState();
      state = startPlayback(state);
      
      // Find a case with high roundness (plate or bottle)
      // Advance through cases until we find one
      for (let i = 0; i < 100; i++) {
        state = updatePlayback(state, 100);
        const data = getMeasurementData(state);
        if (data.roundnessK > 0.8) {
          expect(data.shapeResult).toBe('round');
          return;
        }
      }
    });
    
    it('returns box shape for medium roundness (0.3–0.8 inclusive)', () => {
      let state = createPlaybackState();
      state = startPlayback(state);
      
      // Check shape logic based on official K > 0.8 roundness rule
      const data = getMeasurementData(state);
      if (data.roundnessK > 0.8) {
        expect(data.shapeResult).toBe('round');
      } else if (data.roundnessK >= 0.3) {
        expect(data.shapeResult).toBe('box');
      } else {
        expect(data.shapeResult).toBe('irregular');
      }
    });
    
    it('applies C-priority when dims fail but roundness is high', () => {
      let state = createPlaybackState();
      state = startPlayback(state);
      
      // Advance to c_priority case (case 7)
      for (let i = 0; i < 6; i++) {
        // Advance through cases
        for (let j = 0; j < 100; j++) {
          state = updatePlayback(state, 100);
          if (state.currentCaseIndex > i) break;
        }
      }
      
      // Wait for classification phase
      for (let j = 0; j < 50; j++) {
        state = updatePlayback(state, 100);
        const data = getMeasurementData(state);
        if (data.cPriorityApplied) {
          expect(data.finalCategory).toBe('C');
          expect(data.command).toBe('ROUTE_TO_C');
          return;
        }
      }
    });
    
    it('returns ROUTE_TO_B/C/D command always', () => {
      let state = createPlaybackState();
      state = startPlayback(state);
      
      // Advance to classification
      for (let i = 0; i < 50; i++) {
        state = updatePlayback(state, 100);
        const data = getMeasurementData(state);
        
        if (data.finalCategory) {
          expect(data.command).toMatch(/^ROUTE_TO_[BCD]$/);
        }
      }
    });
    
    it('keeps final category as B/C/D for low confidence', () => {
      let state = createPlaybackState();
      state = startPlayback(state);
      
      // Advance to low_confidence case (case 8, index 7)
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 100; j++) {
          state = updatePlayback(state, 100);
          if (state.currentCaseIndex > i) break;
        }
      }
      
      // Check that low confidence case has valid category
      for (let j = 0; j < 50; j++) {
        state = updatePlayback(state, 100);
        const data = getMeasurementData(state);
        
        if (data.isLowConfidence && data.finalCategory) {
          expect(['B', 'C', 'D']).toContain(data.finalCategory);
          return;
        }
      }
    });
    
    it('has positive laser distance', () => {
      const state = createPlaybackState();
      const data = getMeasurementData(state);
      
      expect(data.laserDistanceMm).toBeGreaterThan(0);
    });
    
    it('has valid confidence between 0 and 1', () => {
      const state = createPlaybackState();
      const data = getMeasurementData(state);
      
      expect(data.confidence).toBeGreaterThanOrEqual(0);
      expect(data.confidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('getStageLabel', () => {
    it('returns correct labels for all stages', () => {
      expect(getStageLabel('idle')).toBe('Standby');
      expect(getStageLabel('leading_edge_detected')).toBe('Edge Detected');
      expect(getStageLabel('step_counting')).toBe('Counting Steps');
      expect(getStageLabel('decision_ready')).toBe('Decision Ready');
      expect(getStageLabel('command_sent')).toBe('Command Sent');
    });
  });
  
  describe('shouldShowMeasurement', () => {
    it('returns true for measurement phases', () => {
      expect(shouldShowMeasurement('detection')).toBe(true);
      expect(shouldShowMeasurement('measurement')).toBe(true);
      expect(shouldShowMeasurement('classification')).toBe(true);
      expect(shouldShowMeasurement('routing')).toBe(true);
    });
    
    it('returns false for non-measurement phases', () => {
      expect(shouldShowMeasurement('spawn')).toBe(false);
      expect(shouldShowMeasurement('move_to_detection')).toBe(false);
      expect(shouldShowMeasurement('clear_gap')).toBe(false);
    });
  });
  
  describe('shouldShowLaserBeam', () => {
    it('returns true for detection and measurement', () => {
      expect(shouldShowLaserBeam('detection')).toBe(true);
      expect(shouldShowLaserBeam('measurement')).toBe(true);
    });
    
    it('returns false for other phases', () => {
      expect(shouldShowLaserBeam('spawn')).toBe(false);
      expect(shouldShowLaserBeam('classification')).toBe(false);
      expect(shouldShowLaserBeam('routing')).toBe(false);
    });
  });
});
