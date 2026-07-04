import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { detectWebGL, useWebGLSupport } from './useWebGL';
import { PHYSICS_ENGINE_ENABLED } from './itemMotion';

function SpikeScene({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef<number[]>([]);
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (dt <= 0) return;
    const fps = 1000 / dt;
    frames.current.push(fps);
    if (frames.current.length > 60) {
      frames.current.shift();
    }
    const avg = frames.current.reduce((a, b) => a + b, 0) / frames.current.length;
    onFps(Math.round(avg));
  });

  const boxes = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        key: index,
        position: [((index % 4) - 1.5) * 0.45, 0.2 + Math.floor(index / 4) * 0.35, -0.4] as [
          number,
          number,
          number,
        ],
      })),
    [],
  );

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 2]} intensity={0.85} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color="#0b1725" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3.5, 0.2, 0.5]} />
        <meshStandardMaterial color="#1e3a54" />
      </mesh>
      {boxes.map((box) => (
        <mesh key={box.key} position={box.position}>
          <boxGeometry args={[0.28, 0.28, 0.28]} />
          <meshStandardMaterial color={box.key % 3 === 0 ? '#4ade80' : box.key % 3 === 1 ? '#f59e0b' : '#c084fc'} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Diagnostic utility: WebGL probe + lightweight scene FPS.
 * Physics engine is intentionally not loaded (see PHYSICS_ENGINE_ENABLED).
 */
export default function ThreeCapabilityCheck() {
  const webgl = useWebGLSupport();
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="three-capability-check">
      <div className="three-capability-meta">
        <strong>3D capability check</strong>
        <span>WebGL: {webgl ? 'OK' : 'unavailable'}</span>
        <span>Physics engine: {PHYSICS_ENGINE_ENABLED ? 'enabled' : 'disabled (state-machine motion)'}</span>
        <span>Avg FPS: {webgl && ready ? fps : '—'}</span>
        <span>Runtime detect: {detectWebGL() ? 'yes' : 'no'}</span>
      </div>
      {webgl && ready ? (
        <div className="three-capability-canvas">
          <Canvas camera={{ position: [2.5, 2.2, 3.2], fov: 45 }} dpr={[1, 1.5]}>
            <SpikeScene onFps={setFps} />
          </Canvas>
        </div>
      ) : (
        <p className="three-fallback-note">WebGL недоступен — 3D digital twin будет в 2D fallback.</p>
      )}
    </div>
  );
}
