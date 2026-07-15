/**
 * Compact FPS / GPU overlay. Visible only with ?perf=1 and outside presentation mode.
 */

import { useEffect, useState } from 'react';
import {
  isPerfQueryEnabled,
  type PerfSnapshot,
  emptyPerfSnapshot,
} from '../../domain/perfMetrics';

const POLL_MS = 500;

export interface PerfOverlayProps {
  /** Force show (still hidden in presentation mode via CSS / class check) */
  enabled?: boolean;
}

export default function PerfOverlay({ enabled }: PerfOverlayProps) {
  const [visible, setVisible] = useState(
    () => enabled === true || (enabled !== false && isPerfQueryEnabled()),
  );
  const [snap, setSnap] = useState<PerfSnapshot>(() => emptyPerfSnapshot());
  const [inPresentation, setInPresentation] = useState(false);

  useEffect(() => {
    if (enabled === false) {
      setVisible(false);
      return;
    }
    setVisible(enabled === true || isPerfQueryEnabled());
  }, [enabled]);

  useEffect(() => {
    if (!visible) return;

    const poll = () => {
      const s = window.__PERF_SNAPSHOT__;
      if (s) setSnap(s);
      setInPresentation(!!document.querySelector('.presentation-mode'));
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible || inPresentation) return null;

  const soft = !snap.hardwareAccelerated;

  return (
    <div
      className="perf-overlay"
      data-testid="perf-overlay"
      aria-label="Performance metrics"
    >
      <div className="perf-overlay-title">PERF</div>
      <div>
        FPS {snap.averageFps.toFixed(0)}
        <span className="perf-muted"> (min {snap.minimumFps.toFixed(0)})</span>
      </div>
      <div>
        p95 {snap.p95FrameTimeMs.toFixed(1)}ms
        <span className="perf-muted"> / p99 {snap.p99FrameTimeMs.toFixed(1)}ms</span>
      </div>
      <div>
        draws {snap.drawCalls}
        <span className="perf-muted"> · tris {snap.triangles}</span>
      </div>
      <div>
        geo {snap.geometries}
        <span className="perf-muted">
          {' '}
          · tex {snap.textures} · prog {snap.programs}
        </span>
      </div>
      <div>
        heap {snap.heapMb.toFixed(1)}MB
        <span className="perf-muted">
          {' '}
          · dpr {snap.dpr} · {snap.mode}
        </span>
      </div>
      <div className={soft ? 'perf-soft' : 'perf-hw'} title={snap.renderer}>
        {soft ? 'SW' : 'GPU'} {snap.renderer.slice(0, 42)}
        {snap.renderer.length > 42 ? '…' : ''}
      </div>
    </div>
  );
}
