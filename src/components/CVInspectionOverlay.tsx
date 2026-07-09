/**
 * CV Inspection Overlay — industrial camera monitor style panel.
 * Shows detection, measurement, and classification data.
 */

import type { InspectionData } from '../domain/inspectionViewModel';

interface CVInspectionOverlayProps {
  data: InspectionData;
}

const SHAPE_ICONS: Record<string, string> = {
  box: '▭',
  cylinder: '⬤',
  round: '◯',
  irregular: '◇',
  unknown: '?',
};

export default function CVInspectionOverlay({ data }: CVInspectionOverlayProps) {
  if (!data.visible) return null;

  const {
    phaseLabel,
    itemTitle,
    shape,
    dimensions,
    roundness,
    confidence,
    isLowConfidence,
    category,
    command,
    warning,
    dimensionsFail,
    roundnessFail,
    cPriority,
  } = data;

  const confidencePercent = Math.round(confidence * 100);
  const roundnessPercent = Math.round(roundness * 100);
  
  const categoryColors: Record<string, string> = {
    B: '#22c55e',
    C: '#f97316',
    D: '#8b5cf6',
  };

  return (
    <div className="cv-overlay">
      <div className="cv-header">
        <span className="cv-icon">📷</span>
        <span className="cv-title">CV INSPECTION</span>
        <span className={`cv-status ${data.phase}`}>{phaseLabel}</span>
      </div>

      <div className="cv-body">
        <div className="cv-row cv-item-row">
          <span className="cv-label">ITEM</span>
          <span className="cv-value">{itemTitle}</span>
        </div>

        <div className="cv-divider" />

        <div className="cv-row">
          <span className="cv-label">SHAPE</span>
          <span className="cv-value cv-shape">
            <span className="shape-icon">{SHAPE_ICONS[shape]}</span>
            {shape}
          </span>
        </div>

        <div className="cv-row cv-dims-row">
          <span className="cv-label">SIZE</span>
          <span className={`cv-value cv-dims ${dimensionsFail ? 'fail' : 'pass'}`}>
            {dimensions.width} × {dimensions.depth} × {dimensions.height} mm
          </span>
        </div>

        <div className="cv-row">
          <span className="cv-label">ROUNDNESS</span>
          <span className={`cv-value ${roundnessFail ? 'fail' : 'pass'}`}>
            K = {(roundness).toFixed(2)} ({roundnessPercent}%)
            {roundnessFail && <span className="cv-flag"> ⚠ ≥0.7</span>}
          </span>
        </div>

        <div className="cv-row">
          <span className="cv-label">CONFIDENCE</span>
          <span className={`cv-value ${isLowConfidence ? 'warning' : ''}`}>
            {confidencePercent}%
            {isLowConfidence && <span className="cv-flag"> ⚠ LOW</span>}
          </span>
        </div>

        <div className="cv-divider" />

        {category && (
          <div className="cv-row cv-result-row">
            <span className="cv-label">CLASS</span>
            <span 
              className="cv-value cv-category"
              style={{ color: categoryColors[category] }}
            >
              {category}
              {cPriority && <span className="cv-priority"> (C priority)</span>}
            </span>
          </div>
        )}

        <div className="cv-row cv-command-row">
          <span className="cv-label">CMD</span>
          <span 
            className="cv-value cv-command"
            style={{ color: category ? categoryColors[category] : '#64748b' }}
          >
            {command}
          </span>
        </div>

        {warning && (
          <div className="cv-warning">
            <span className="warning-icon">⚠</span>
            <span className="warning-text">{warning}</span>
          </div>
        )}
      </div>

      <div className="cv-footer">
        <span className="cv-live">● LIVE</span>
        <span className="cv-fps">60 FPS</span>
      </div>
    </div>
  );
}
