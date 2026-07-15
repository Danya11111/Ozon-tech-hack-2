import { lazy, Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ThreeErrorBoundary from '../components/ThreeD/ThreeErrorBoundary';
import { prefer3DByDefault, useWebGLSupport } from '../components/ThreeD/useWebGL';
import { DEMO_PLAYLIST, PLAYLIST_LENGTH } from '../domain/demoPlaylist';
import type { ContinuousPlaybackState, PlaybackSpeed } from '../domain/continuousPlayback';
import { getCaseProgress, getCurrentPhaseConfig, isFaultActive } from '../domain/continuousPlayback';
import { getMeasurementData, shouldShowMeasurement } from '../domain/measurementSystem';
import { getViewportType, type ViewportType } from '../domain/cinematicCamera';
import { detectQualityMode } from '../domain/qualityMode';
import { resolveItem } from '../data/resolveItem';
import BuildIdentityBadge from '../components/BuildIdentityBadge';
import CVInspectionOverlay from '../components/CVInspectionOverlay';

const SorterDigitalTwinContinuous = lazy(() => import('../components/ThreeD/SorterDigitalTwinContinuous'));

interface MainPageProps {
  playback: ContinuousPlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeekCase: (index: number) => void;
  onSeekNext: () => void;
  onSeekPrev: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

export default function MainPage({
  playback,
  onPlay,
  onPause,
  onStop,
  onSeekCase,
  onSeekNext,
  onSeekPrev,
  onSetSpeed,
}: MainPageProps) {
  const webgl = useWebGLSupport();
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  const [contextLost, setContextLost] = useState(false);
  const [autoCameraEnabled, setAutoCameraEnabled] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Hotkeys for live demo resilience
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (playback.status === 'running') onPause();
          else onPlay();
          break;
        case 'r':
          onStop();
          onPlay();
          break;
        case 'n':
        case 'arrowright':
          onSeekNext();
          break;
        case 'b':
        case 'arrowleft':
          onSeekPrev();
          break;
        case 'f':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => undefined);
          } else {
            document.exitFullscreen?.().catch(() => undefined);
          }
          break;
        case 'p':
          setPresentationMode((v) => !v);
          break;
        case 'e':
          setShowEventLog((v) => !v);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '0': {
          const idx = e.key === '0' ? 9 : Number(e.key) - 1;
          if (idx < PLAYLIST_LENGTH) onSeekCase(idx);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback.status, onPlay, onPause, onStop, onSeekNext, onSeekPrev, onSeekCase]);

  const show3D = prefer3DByDefault(width, webgl && !contextLost);
  const qualityOverride = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'low' || q === 'medium' || q === 'high' || q === 'demo') return q;
    return undefined;
  }, []);
  const qualityMode = qualityOverride ?? detectQualityMode(width);
  const simplified = width < 900 || qualityMode === 'low';
  const viewportType: ViewportType = getViewportType(width);

  const isRunning = playback.status === 'running';
  const isPaused = playback.status === 'paused';
  const isFinished = playback.status === 'finished';
  const faultActive = isFaultActive(playback);

  const currentCase = playback.currentCase;
  const category = playback.targetCategory;
  const command = playback.command;
  const phaseConfig = getCurrentPhaseConfig(playback);
  const caseProgress = getCaseProgress(playback);

  const measurementData = useMemo(() => getMeasurementData(playback), [playback]);
  const showMeasurement =
    !presentationMode &&
    shouldShowMeasurement(playback.currentPhase) &&
    (isRunning || isPaused) &&
    !isFinished;

  const handlePlayPause = () => {
    if (isRunning) onPause();
    else onPlay();
  };

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    setPresentationMode(true);
  }, []);

  return (
    <div className={`main-page ${presentationMode ? 'presentation-mode' : ''} ${faultActive ? 'fault-active' : ''}`}>
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
                autoCameraEnabled={autoCameraEnabled}
                viewportType={viewportType}
                qualityMode={qualityMode}
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

      {width >= 768 && (
        <CVInspectionOverlay data={measurementData} visible={showMeasurement} />
      )}

      {!presentationMode && (
        <div className="main-hud" data-testid="demo-hud">
          <div className="hud-row">
            <span className="hud-label">Item</span>
            <span className="hud-value">{currentCase.title}</span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Status</span>
            <span
              className={`hud-value status-${playback.status} ${faultActive ? 'status-fault' : ''}`}
              data-testid="demo-status"
            >
              {isFinished ? 'FINISHED' : phaseConfig.label}
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Category</span>
            <span
              className={`hud-value ${category ? `category-${category}` : ''}`}
              data-testid="demo-category"
            >
              {category ?? '—'}
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Command</span>
            <span className="hud-value" data-testid="demo-command">{command}</span>
          </div>
          {playback.classification && (
            <div className="hud-row hud-row-small" data-testid="demo-proof">
              <span className="hud-value proof-text">
                {playback.classification.dimensionsPass ? 'DIM✓' : 'DIM✗'} · K=
                {resolveItem(currentCase.itemId).roundness.toFixed(2)} · {playback.classification.reason}
              </span>
            </div>
          )}
          <div className="hud-row">
            <span className="hud-label">Speed</span>
            <span className="hud-value">{playback.speed.toFixed(1)}× · 1.0 m/s</span>
          </div>
          {playback.warning && (
            <div className="hud-row hud-warning">
              <span className="hud-value warning-text">⚠ {playback.warning}</span>
            </div>
          )}
          <div className="hud-divider" />
          <div className="hud-row">
            <span className="hud-label">Case</span>
            <span className="hud-value" data-testid="demo-case-label">
              {playback.currentCaseIndex + 1}/{PLAYLIST_LENGTH}
            </span>
          </div>
          <div className="hud-row hud-row-small">
            <span className="hud-value">{currentCase.description}</span>
          </div>
        </div>
      )}

      <div className="main-case-progress">
        <div
          className={`case-progress-bar ${faultActive ? 'fault' : ''}`}
          style={{ width: `${caseProgress * 100}%` }}
        />
      </div>

      {!presentationMode && (
        <div className="main-progress">
          {DEMO_PLAYLIST.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              className={`progress-dot ${idx === playback.currentCaseIndex ? 'active' : ''} ${idx < playback.currentCaseIndex ? 'done' : ''} ${c.faultType ? 'fault-dot' : ''}`}
              title={`${idx + 1}. ${c.title} → ${c.faultType ?? c.expectedCategory}`}
              onClick={() => onSeekCase(idx)}
              aria-label={`Jump to case ${idx + 1}`}
              data-testid={`demo-case-${idx}`}
            />
          ))}
        </div>
      )}

      <div className="main-controls">
        <button
          type="button"
          className="ctrl-nav"
          onClick={onSeekPrev}
          aria-label="Previous case"
          title="Prev (← / B)"
          data-testid="demo-prev"
        >
          ⏮
        </button>
        <button
          type="button"
          className="play-button"
          onClick={handlePlayPause}
          aria-label={isRunning ? 'Pause demo' : 'Play demo'}
          data-testid={isRunning ? 'demo-pause' : 'demo-play'}
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
        <button
          type="button"
          className="ctrl-nav"
          onClick={onSeekNext}
          aria-label="Next case"
          title="Next (→ / N)"
          data-testid="demo-next"
        >
          ⏭
        </button>

        {(isRunning || isPaused) && (
          <button
            type="button"
            className="stop-button"
            onClick={onStop}
            aria-label="Stop demo"
            title="Reset (R)"
            data-testid="demo-stop"
          >
            ⏹
          </button>
        )}

        {!presentationMode && (
          <div className="speed-controls" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-btn ${playback.speed === s ? 'active' : ''}`}
                onClick={() => onSetSpeed(s)}
                data-testid={`demo-speed-${s}`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>

      {isFinished && (
        <div className="main-finished-overlay" data-testid="demo-finished">
          <div className="finished-content">
            <h2>Demo Complete</h2>
            <p>All {PLAYLIST_LENGTH} cases demonstrated — including safety scenarios</p>
            <button type="button" className="btn-primary" onClick={onPlay}>
              Replay Demo
            </button>
          </div>
        </div>
      )}

      {showEventLog && !presentationMode && (
        <div className="main-event-log" aria-live="polite" data-testid="demo-event-log">
          <div className="event-log-header">Event journal</div>
          <ul>
            {playback.events.slice(0, 8).map((ev) => (
              <li key={ev.id} className={`evt-${ev.status}`}>
                <span className="evt-time">{Math.round(ev.timestampMs / 1000)}s</span>
                <span className="evt-msg">{ev.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {show3D && !presentationMode && (
        <button
          type="button"
          className="auto-camera-toggle"
          onClick={() => setAutoCameraEnabled(!autoCameraEnabled)}
          title={autoCameraEnabled ? 'Disable auto camera to control manually' : 'Enable cinematic auto camera'}
        >
          <span className="toggle-icon">{autoCameraEnabled ? '🎬' : '🎥'}</span>
          <span className="toggle-label">Auto Cam: {autoCameraEnabled ? 'ON' : 'OFF'}</span>
        </button>
      )}

      {!presentationMode && (
        <>
          <button
            type="button"
            className="presentation-toggle"
            onClick={enterFullscreen}
            title="Presentation (P / F)"
            data-testid="demo-presentation"
          >
            Present
          </button>
          <Link to="/details" className="details-link">
            Details →
          </Link>
          <div className="hotkey-hint">Space play · N/B seek · 1–0 jump · R reset · P present · E log · F fullscreen</div>
        </>
      )}

      {presentationMode && (
        <button type="button" className="presentation-exit" onClick={() => setPresentationMode(false)}>
          Exit presentation (P)
        </button>
      )}

      <BuildIdentityBadge />
    </div>
  );
}
