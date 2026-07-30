/**
 * /device-test — compact mobile diagnostic overlay (Stage 2D).
 * No PII beyond UA string; for phone smoke / QR checks.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { decideMobileTier, collectMobileSignals } from '../domain/mobilePolicy';
import { prefer3DByDefault, useWebGLSupport } from '../components/ThreeD/useWebGL';

interface GlInfo {
  vendor: string;
  renderer: string;
  webgl2: boolean;
  software: boolean;
}

function readGl(): GlInfo {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) {
      return { vendor: 'none', renderer: 'none', webgl2: false, software: true };
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg
      ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const software = /swiftshader|llvmpipe|softpipe|software/i.test(renderer);
    return { vendor, renderer, webgl2: !!c.getContext('webgl2'), software };
  } catch {
    return { vendor: 'error', renderer: 'error', webgl2: false, software: true };
  }
}

export default function DeviceTestPage() {
  const webgl = useWebGLSupport();
  const [gl, setGl] = useState<GlInfo | null>(null);
  const [fps, setFps] = useState(0);
  const signals = collectMobileSignals();
  const tier = decideMobileTier(signals);
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const prefer3d = prefer3DByDefault(width, webgl);

  useEffect(() => {
    setGl(readGl());
  }, []);

  useEffect(() => {
    let frames = 0;
    let start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames += 1;
      if (t - start >= 1000) {
        setFps(Math.round((frames * 1000) / (t - start)));
        frames = 0;
        start = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isTelegram = /Telegram/i.test(ua);

  return (
    <div
      className="device-test-page"
      data-testid="device-test-page"
      style={{
        minHeight: '100dvh',
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        background: '#0b1220',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Device Test</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        OZON Tech Sorter — Stage 2D diagnostics (no personal data).
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
        <Row k="UA" v={ua.slice(0, 140)} />
        <Row k="WebGL support" v={webgl ? 'YES' : 'NO'} />
        <Row k="Prefer 3D" v={String(prefer3d)} />
        <Row k="Mobile tier" v={String(tier)} />
        <Row k="DPR" v={String(typeof window !== 'undefined' ? window.devicePixelRatio : 1)} />
        <Row
          k="Viewport"
          v={typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '—'}
        />
        <Row k="Page FPS (UI)" v={String(fps)} />
        <Row k="Telegram WebView" v={isTelegram ? 'YES' : 'NO'} />
        <Row k="GL vendor" v={gl?.vendor ?? '…'} />
        <Row k="GL renderer" v={gl?.renderer ?? '…'} />
        <Row k="WebGL2" v={String(gl?.webgl2 ?? false)} />
        <Row k="Software GL" v={String(gl?.software ?? true)} />
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/" data-testid="device-test-open-sim" style={{ color: '#38bdf8' }}>
          Open simulation →
        </Link>
        <Link to="/?quality=low" style={{ color: '#94a3b8' }}>
          Mobile Low
        </Link>
        <Link to="/?perf=1" style={{ color: '#94a3b8' }}>
          Perf overlay
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 8,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 6,
      }}
    >
      <span style={{ color: '#64748b' }}>{k}</span>
      <span style={{ wordBreak: 'break-word' }}>{v}</span>
    </div>
  );
}
