import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
import DocumentationPage from './pages/DocumentationPage';
import {
  createPlaybackState,
  startPlayback,
  pausePlayback,
  resumePlayback,
  stopPlayback,
  updatePlayback,
  seekToCase,
  seekNextCase,
  seekPrevCase,
  setPlaybackSpeed,
  type ContinuousPlaybackState,
  type PlaybackSpeed,
} from './domain/continuousPlayback';

function AppContent() {
  const [playback, setPlayback] = useState<ContinuousPlaybackState>(() => createPlaybackState());

  const playbackRafRef = useRef<number | null>(null);
  const playbackLastRef = useRef(performance.now());
  const PLAYBACK_INTERVAL = 50;

  // Public page autostarts the sorter loop; ?playback=paused keeps it idle
  // (used by screenshot/debug tooling). First item is gated in the 3D scene
  // until PRODUCT_ASSETS_READY (see SorterDigitalTwinContinuous).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('playback') === 'paused') return;
    setPlayback((prev) => (prev.status === 'idle' ? startPlayback(prev) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (playback.status !== 'running') {
      if (playbackRafRef.current) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = performance.now();
      const deltaMs = now - playbackLastRef.current;

      if (deltaMs >= PLAYBACK_INTERVAL) {
        playbackLastRef.current = now;
        setPlayback((prev) => updatePlayback(prev, deltaMs));
      }

      playbackRafRef.current = requestAnimationFrame(tick);
    };

    playbackLastRef.current = performance.now();
    playbackRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackRafRef.current) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [playback.status]);

  const handleMainPlay = useCallback(() => {
    setPlayback((prev) => {
      if (prev.status === 'paused') {
        return resumePlayback(prev);
      }
      return startPlayback(prev);
    });
  }, []);

  const handleMainPause = useCallback(() => {
    setPlayback((prev) => pausePlayback(prev));
  }, []);

  const handleMainStop = useCallback(() => {
    setPlayback(stopPlayback);
  }, []);

  const handleSeekCase = useCallback((index: number) => {
    setPlayback((prev) => seekToCase(prev, index));
  }, []);

  const handleSeekNext = useCallback(() => {
    setPlayback((prev) => seekNextCase(prev));
  }, []);

  const handleSeekPrev = useCallback(() => {
    setPlayback((prev) => seekPrevCase(prev));
  }, []);

  const handleSetSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlayback((prev) => setPlaybackSpeed(prev, speed));
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainPage
            playback={playback}
            onPlay={handleMainPlay}
            onPause={handleMainPause}
            onStop={handleMainStop}
            onSeekCase={handleSeekCase}
            onSeekNext={handleSeekNext}
            onSeekPrev={handleSeekPrev}
            onSetSpeed={handleSetSpeed}
          />
        }
      />
      <Route path="/documentation" element={<DocumentationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
