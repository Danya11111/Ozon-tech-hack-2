import { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ThreeFallback from '../components/ThreeD/ThreeFallback';
import ThreeErrorBoundary from '../components/ThreeD/ThreeErrorBoundary';
import { prefer3DByDefault, useWebGLSupport } from '../components/ThreeD/useWebGL';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from '../domain/demoPlaylist';
import type { ContinuousPlaybackState } from '../domain/continuousPlayback';
import { getCaseProgress, getCurrentPhaseConfig } from '../domain/continuousPlayback';
import { getMeasurementData, shouldShowMeasurement } from '../domain/measurementSystem';
import CVInspectionOverlay from '../components/CVInspectionOverlay';

const SorterDigitalTwinContinuous = lazy(() => import('../components/ThreeD/SorterDigitalTwinContinuous'));

interface MainPageProps {
  playback: ContinuousPlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function MainPage({
  playback,
  onPlay,
  onPause,
  onStop,
}: MainPageProps) {
  const webgl = useWebGLSupport();
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const show3D = prefer3DByDefault(width, webgl && !contextLost);
  const simplified = width < 900;

  const isRunning = playback.status === 'running';
  const isPaused = playback.status === 'paused';
  const isFinished = playback.status === 'finished';

  const currentCase = playback.currentCase;
  const category = playback.targetCategory;
  const command = playback.command;
  const phaseConfig = getCurrentPhaseConfig(playback);
  const caseProgress = getCaseProgress(playback);
  
  const measurementData = useMemo(() => getMeasurementData(playback), [playback]);
  const showMeasurement = shouldShowMeasurement(playback.currentPhase) && (isRunning || isPaused) && !isFinished;

  const handlePlayPause = () => {
    if (isRunning) {
      onPause();
    } else {
      onPlay();
    }
  };

  return (
    <div className="main-page">
      {/* Full-screen 3D Demo */}
      <div className="main-demo-viewport">
        {show3D ? (
          <ThreeErrorBoundary
            onError={(error) => {
              console.error('3D Canvas failed:', error);
              setContextLost(true);
            }}
          >
            <Suspense fallback={<div className="three-loading">Loading 3D...</div>}>
              <SorterDigitalTwinContinuous
                playback={playback}
                simplified={simplified}
                onContextLost={() => setContextLost(true)}
              />
            </Suspense>
          </ThreeErrorBoundary>
        ) : (
          <div className="main-fallback">
            <div className="fallback-content">
              <h2>3D Demo</h2>
              <p>WebGL not available. Please use a modern browser.</p>
              <Link to="/details" className="btn-primary">View Details Page</Link>
            </div>
          </div>
        )}
      </div>

      {/* Measurement System Overlay - right center */}
      {width >= 768 && (
        <CVInspectionOverlay data={measurementData} visible={showMeasurement} />
      )}

      {/* Minimal HUD - top right */}
      <div className="main-hud">
        <div className="hud-row">
          <span className="hud-label">Item</span>
          <span className="hud-value">{currentCase.title}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Status</span>
          <span className={`hud-value status-${playback.status}`}>
            {isFinished ? 'FINISHED' : phaseConfig.label}
          </span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Category</span>
          <span className={`hud-value ${category ? `category-${category}` : ''}`}>
            {category ?? '—'}
          </span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Command</span>
          <span className="hud-value">{command}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Speed</span>
          <span className="hud-value">1.0 m/s</span>
        </div>
        {playback.warning && (
          <div className="hud-row hud-warning">
            <span className="hud-value warning-text">⚠ {playback.warning}</span>
          </div>
        )}
        <div className="hud-divider" />
        <div className="hud-row">
          <span className="hud-label">Case</span>
          <span className="hud-value">{playback.currentCaseIndex + 1}/{PLAYLIST_LENGTH}</span>
        </div>
        <div className="hud-row hud-row-small">
          <span className="hud-value">{currentCase.description}</span>
        </div>
      </div>

      {/* Case progress bar */}
      <div className="main-case-progress">
        <div className="case-progress-bar" style={{ width: `${caseProgress * 100}%` }} />
      </div>

      {/* Playlist progress dots */}
      <div className="main-progress">
        {DEMO_PLAYLIST.map((c, idx) => (
          <div
            key={c.id}
            className={`progress-dot ${idx === playback.currentCaseIndex ? 'active' : ''} ${idx < playback.currentCaseIndex ? 'done' : ''}`}
            title={`${idx + 1}. ${c.title} → ${c.expectedCategory}`}
          />
        ))}
      </div>

      {/* Play/Pause Button - center bottom */}
      <div className="main-controls">
        <button
          type="button"
          className="play-button"
          onClick={handlePlayPause}
          aria-label={isRunning ? 'Pause demo' : 'Play demo'}
        >
          {isRunning ? (
            <span className="play-icon">⏸</span>
          ) : (
            <span className="play-icon">▶</span>
          )}
          <span className="play-text">
            {isRunning ? 'Pause' : isPaused ? 'Resume' : isFinished ? 'Replay' : 'Play Demo'}
          </span>
        </button>

        {(isRunning || isPaused) && (
          <button type="button" className="stop-button" onClick={onStop} aria-label="Stop demo">
            ⏹
          </button>
        )}
      </div>

      {/* Finished overlay */}
      {isFinished && (
        <div className="main-finished-overlay">
          <div className="finished-content">
            <h2>Demo Complete</h2>
            <p>All 8 cases demonstrated successfully</p>
            <button type="button" className="btn-primary" onClick={onPlay}>
              Replay Demo
            </button>
          </div>
        </div>
      )}

      {/* Details link - bottom right */}
      <Link to="/details" className="details-link">
        Details →
      </Link>
    </div>
  );
}
