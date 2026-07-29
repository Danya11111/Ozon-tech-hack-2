/**
 * PostProcessingSpike — Stage 0 cost-measurement only.
 *
 * Loaded lazily (separate chunk) and mounted ONLY in stage0 prototype mode
 * with post=1. Default route never downloads @react-three/postprocessing.
 * Deliberately cheap set: Bloom + Vignette + Noise + SMAA. No DoF, no SSR,
 * no motion blur, no TAA, no volumetrics.
 */

import { EffectComposer, Bloom, Vignette, Noise, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export default function PostProcessingSpike() {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <Bloom intensity={0.35} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.25} />
      <Vignette offset={0.25} darkness={0.55} eskil={false} />
    </EffectComposer>
  );
}
