/**
 * Stage 2 §16 — mobile capability policy.
 *
 * Decides what a mobile client gets, WITHOUT using viewport width alone:
 *  - 'svg'        — weak/unknown device or Telegram WebView → SVG fallback;
 *  - 'mobile-low' — capable modern phone → 3D at Mobile Low quality
 *                   (DPR<=1.25, no post, LOD2-equivalent scene, 30 FPS target,
 *                    single active dynamic item);
 *  - 'full'       — not a mobile device (desktop policy applies elsewhere).
 *
 * Signals: UA class, Telegram WebView markers, hardwareConcurrency,
 * deviceMemory, WebGL renderer string. First-FPS watchdog is applied
 * separately at runtime (MobileFpsWatchdog).
 */

export type MobileTier = 'svg' | 'mobile-low' | 'full';

export interface MobileSignals {
  userAgent: string;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  webglRenderer: string | null;
  hasTelegramProxy: boolean;
}

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const TELEGRAM_UA_RE = /Telegram/i;
const SOFTWARE_GL_RE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function isMobileUa(userAgent: string): boolean {
  return MOBILE_UA_RE.test(userAgent);
}

export function isTelegramWebView(signals: Pick<MobileSignals, 'userAgent' | 'hasTelegramProxy'>): boolean {
  return TELEGRAM_UA_RE.test(signals.userAgent) || signals.hasTelegramProxy;
}

/**
 * Telegram WebView policy (Stage 2 §16): forced SVG until verified on a real
 * Telegram WebView — conservative, honest (no 3D claims without a device).
 */
export function decideMobileTier(signals: MobileSignals): MobileTier {
  if (!isMobileUa(signals.userAgent)) return 'full';
  if (isTelegramWebView(signals)) return 'svg';
  if (signals.webglRenderer && SOFTWARE_GL_RE.test(signals.webglRenderer)) return 'svg';
  const cores = signals.hardwareConcurrency ?? 0;
  const mem = signals.deviceMemoryGb ?? 0;
  // Capable-device gate: enough cores and memory for Mobile Low.
  if (cores >= 8 && (mem === 0 || mem >= 4)) return 'mobile-low';
  if (cores >= 6 && mem >= 6) return 'mobile-low';
  return 'svg';
}

/** Runtime signals collector (browser-only; SSR-safe). */
export function collectMobileSignals(): MobileSignals {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', hardwareConcurrency: null, deviceMemoryGb: null, webglRenderer: null, hasTelegramProxy: false };
  }
  let renderer: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    renderer = null;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const w = window as unknown as { TelegramWebviewProxy?: unknown };
  return {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    webglRenderer: renderer,
    hasTelegramProxy: typeof w !== 'undefined' && w.TelegramWebviewProxy != null,
  };
}

/** First-FPS watchdog threshold: below this sustained FPS mobile drops to SVG. */
export const MOBILE_MIN_FPS = 24;
/** Watchdog sampling window (ms) after 3D mount. */
export const MOBILE_FPS_SAMPLE_MS = 6000;
