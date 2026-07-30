# Bundle impact — Stage 2C

- Build: `vite build` OK (2026-07-30)
- Main twin chunk remains large (~4.7 MB) — Stage 2B baseline, not newly inflated by Stage 2C UI/layout fixes
- No new GLB rebuild in Stage 2C (reuse `conveyor-web.glb`)
- Added domain modules: `cadAssemblyParams.ts`, `physicsConfigHash.ts`, `physicsTimestep.ts` (tiny)
