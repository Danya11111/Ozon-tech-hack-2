/**
 * CV Inspection Overlay — industrial measurement system monitor.
 * Shows stepper, laser, stereo camera data and classification results.
 */

import type { MeasurementData } from '../domain/measurementSystem';
import { getStageLabel } from '../domain/measurementSystem';

interface CVInspectionOverlayProps {
  data: MeasurementData;
  visible: boolean;
}

const SHAPE_ICONS: Record<string, string> = {
  box: '▭',
  round: '◯',
  irregular: '◇',
};

export default function CVInspectionOverlay({ data, visible }: CVInspectionOverlayProps) {
  if (!visible) return null;

  const {
    stage,
    stepCount,
    mmPerStep,
    measuredLengthMm,
    pulseActive,
    laserDistanceMm,
    laserMountHeightMm,
    measuredHeightMm,
    laserBeamActive,
    measuredWidthMm,
    roundnessK,
    stereoActive,
    confidence,
    dimensionsPass,
    shapeResult,
    finalCategory,
    command,
    cPriorityApplied,
    isLowConfidence,
    itemTitle,
    itemDimensions,
  } = data;

  const confidencePercent = Math.round(confidence * 100);
  const roundnessPercent = Math.round(roundnessK * 100);
  const stageLabel = getStageLabel(stage);
  
  const categoryColors: Record<string, string> = {
    B: '#22c55e',
    C: '#f97316',
    D: '#8b5cf6',
  };

  const isActive = stage !== 'idle';

  return (
    <div className="cv-overlay">
      <div className="cv-header">
        <span className="cv-icon">⚙</span>
        <span className="cv-title">MEASUREMENT</span>
        <span className={`cv-status ${isActive ? 'active' : 'idle'}`}>{stageLabel}</span>
      </div>

      <div className="cv-body">
        {/* Item info */}
        <div className="cv-row cv-item-row">
          <span className="cv-label">ITEM</span>
          <span className="cv-value">{itemTitle}</span>
        </div>

        <div className="cv-divider" />

        {/* Stepper motor section */}
        <div className="cv-section-header">
          <span className={`cv-indicator ${pulseActive ? 'pulse' : ''}`}>●</span>
          STEPPER LENGTH
        </div>
        <div className="cv-row cv-compact">
          <span className="cv-label">Pulses</span>
          <span className="cv-value cv-mono">
            {stepCount.toLocaleString()}
            {pulseActive && <span className="cv-blink"> ↑</span>}
          </span>
        </div>
        <div className="cv-row cv-compact">
          <span className="cv-label">mm/step</span>
          <span className="cv-value cv-mono">{mmPerStep.toFixed(3)}</span>
        </div>
        <div className="cv-row">
          <span className="cv-label">Length</span>
          <span className="cv-value cv-result">{measuredLengthMm} mm</span>
        </div>

        <div className="cv-divider" />

        {/* Laser rangefinder section */}
        <div className="cv-section-header">
          <span className={`cv-indicator ${laserBeamActive ? 'active' : ''}`}>●</span>
          LASER HEIGHT
        </div>
        <div className="cv-row cv-compact">
          <span className="cv-label">Mount</span>
          <span className="cv-value cv-mono">{laserMountHeightMm} mm</span>
        </div>
        <div className="cv-row cv-compact">
          <span className="cv-label">Distance</span>
          <span className="cv-value cv-mono">{laserDistanceMm} mm</span>
        </div>
        <div className="cv-row">
          <span className="cv-label">Height</span>
          <span className="cv-value cv-result">{measuredHeightMm} mm</span>
        </div>

        <div className="cv-divider" />

        {/* Stereo camera section */}
        <div className="cv-section-header">
          <span className={`cv-indicator ${stereoActive ? 'active' : ''}`}>●</span>
          STEREO WIDTH/SHAPE
        </div>
        <div className="cv-row">
          <span className="cv-label">Width</span>
          <span className="cv-value cv-result">{measuredWidthMm} mm</span>
        </div>
        <div className="cv-row">
          <span className="cv-label">Shape</span>
          <span className="cv-value cv-shape">
            <span className="shape-icon">{SHAPE_ICONS[shapeResult]}</span>
            {shapeResult}
          </span>
        </div>
        <div className="cv-row">
          <span className="cv-label">Roundness</span>
          <span className={`cv-value ${roundnessK >= 0.7 ? 'warning' : ''}`}>
            K = {roundnessK.toFixed(2)} ({roundnessPercent}%)
            {roundnessK >= 0.7 && <span className="cv-flag"> ≥0.7</span>}
          </span>
        </div>

        <div className="cv-divider" />

        {/* Decision section */}
        <div className="cv-section-header">
          <span className="cv-indicator">●</span>
          PLC DECISION
        </div>
        <div className="cv-row">
          <span className="cv-label">Dims</span>
          <span className={`cv-value ${dimensionsPass ? 'pass' : 'fail'}`}>
            {dimensionsPass ? 'PASS' : 'FAIL'}
            <span className="cv-dims-detail">
              {' '}({itemDimensions.width}×{itemDimensions.depth}×{itemDimensions.height})
            </span>
          </span>
        </div>
        <div className="cv-row">
          <span className="cv-label">Confidence</span>
          <span className={`cv-value ${isLowConfidence ? 'warning' : ''}`}>
            {confidencePercent}%
            {isLowConfidence && <span className="cv-flag"> LOW</span>}
          </span>
        </div>

        {finalCategory && (
          <div className="cv-row cv-result-row">
            <span className="cv-label">CLASS</span>
            <span 
              className="cv-value cv-category"
              style={{ color: categoryColors[finalCategory] }}
            >
              {finalCategory}
              {cPriorityApplied && <span className="cv-priority"> (C priority)</span>}
            </span>
          </div>
        )}

        <div className="cv-row cv-command-row">
          <span className="cv-label">CMD</span>
          <span 
            className="cv-value cv-command"
            style={{ color: finalCategory ? categoryColors[finalCategory] : '#64748b' }}
          >
            {command}
          </span>
        </div>

        {/* Warnings */}
        {cPriorityApplied && (
          <div className="cv-warning cv-cpriority">
            <span className="warning-icon">⚠</span>
            <span className="warning-text">Dims fail overrides roundness → C</span>
          </div>
        )}
        
        {isLowConfidence && (
          <div className="cv-warning">
            <span className="warning-icon">⚠</span>
            <span className="warning-text">Low confidence, rule-based fallback</span>
          </div>
        )}
      </div>

      <div className="cv-footer">
        <span className="cv-live">● LIVE</span>
        <span className="cv-fps">PLC</span>
      </div>
    </div>
  );
}
