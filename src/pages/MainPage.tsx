import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ThreeFallback from '../components/ThreeD/ThreeFallback';
import ThreeErrorBoundary from '../components/ThreeD/ThreeErrorBoundary';
import { prefer3DByDefault, useWebGLSupport } from '../components/ThreeD/useWebGL';
import { DEMO_PLAYLIST, getPlaylistCase, PLAYLIST_LENGTH } from '../domain/demoPlaylist';
import type { SimulationState } from '../domain/types';
import type { DemoDirectorState } from '../domain/demoDirector';

const SorterDigitalTwin = lazy(() => import('../components/ThreeD/SorterDigitalTwin'));

interface MainPageProps {
  simulation: SimulationState;
  demoDirector: DemoDirectorState;
  playlistIndex: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function MainPage({
  simulation,
  demoDirector,
  playlistIndex,
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

  const isRunning = demoDirector.isAutoDemoRunning && !demoDirector.paused;
  const isPaused = demoDirector.isAutoDemoRunning && demoDirector.paused;

  const item = simulation.currentItem;
  const category = item?.classification.category;
  const command = simulation.machineState.startsWith('ROUTE_TO_')
    ? simulation.machineState
    : category
      ? `ROUTE_TO_${category}`
      : 'IDLE';

  const currentCase = getPlaylistCase(playlistIndex);

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
              <SorterDigitalTwin
                simulation={simulation}
                simplified={simplified}
                showFps={false}
                cleanView={true}
                onContextLost={() => setContextLost(true)}
              />
            </Suspense>
          </ThreeErrorBoundary>
        ) : (
          <ThreeFallback
            simulation={simulation}
            reason={!webgl || contextLost ? 'webgl' : width < 640 ? 'mobile' : 'user'}
          />
        )}
      </div>

      {/* Minimal HUD - top right */}
      <div className="main-hud">
        <div className="hud-row">
          <span className="hud-label">Item</span>
          <span className="hud-value">{item?.item.name ?? 'Waiting...'}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Status</span>
          <span className={`hud-value status-${simulation.systemStatus.toLowerCase()}`}>
            {simulation.systemStatus}
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
        <div className="hud-divider" />
        <div className="hud-row">
          <span className="hud-label">Case</span>
          <span className="hud-value">{playlistIndex + 1}/{PLAYLIST_LENGTH}</span>
        </div>
        <div className="hud-row hud-row-small">
          <span className="hud-value">{currentCase.title}</span>
        </div>
      </div>

      {/* Playlist progress bar */}
      <div className="main-progress">
        {DEMO_PLAYLIST.map((c, idx) => (
          <div
            key={c.id}
            className={`progress-dot ${idx === playlistIndex ? 'active' : ''} ${idx < playlistIndex ? 'done' : ''}`}
            title={c.title}
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
          <span className="play-text">{isRunning ? 'Pause' : isPaused ? 'Resume' : 'Play Demo'}</span>
        </button>

        {(isRunning || isPaused) && (
          <button type="button" className="stop-button" onClick={onStop} aria-label="Stop demo">
            ⏹
          </button>
        )}
      </div>

      {/* Details link - bottom right */}
      <Link to="/details" className="details-link">
        Details →
      </Link>

      {/* TODO marker for future playlist auto-advance */}
      {/* TODO: Implement full 8-case auto-advance when one scenario completes.
          Current behavior: plays first playlist case only.
          Need to connect playlist advancement to simulation completion events. */}
    </div>
  );
}
