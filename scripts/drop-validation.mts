/**
 * Stage 2B §16 — mandatory drop validation: 7 routes × 10 runs (headless Rapier).
 *
 * Uses the SAME simulateDrop as the unit tests — same colliders, profiles,
 * handoff and pusher as the runtime. Writes docs/stage2_real_sorter/drop-validation.json.
 *
 * Note: the sim is deterministic (fixed dt, no RNG), so the 10 runs per route
 * are identical repetitions validating stability, not a Monte Carlo sample.
 * Runtime variability is covered by the browser e2e (variable frame rate).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRapier, simulateDrop } from '../src/domain/physicsDropSim';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../docs/stage2_real_sorter/drop-validation.json');

const RUNS = 10;
const ROUTES: { sku: string; zone: 'B' | 'C' | 'D'; label: string }[] = [
  { sku: 'SKU-001', zone: 'B', label: 'box → B' },
  { sku: 'SKU-009', zone: 'C', label: 'pen → C' },
  { sku: 'SKU-005', zone: 'C', label: 'pouf → C' },
  { sku: 'SKU-004', zone: 'C', label: 'oversized → C' },
  { sku: 'SKU-007', zone: 'D', label: 'bottle → D' },
  { sku: 'SKU-006', zone: 'D', label: 'plate → D' },
  { sku: 'SKU-008', zone: 'D', label: 'cylinder → D' },
];

// Work-area bounds (m) — anything outside is out-of-bounds.
const BOUNDS = { x: [-2.6, 4.2], y: [-0.05, 2.5], z: [-2.6, 2.6] };
const SPEED_TELEPORT_CAP = 8; // m/s — above this is a solver blowup/teleport
const PENETRATION_DEPTH = 0.006; // m below the belt surface = critical penetration

await initRapier();

const report = {
  generatedAt: new Date().toISOString(),
  sim: 'headless Rapier via simulateDrop (deterministic, dt=1/60, settle 6s)',
  runs: RUNS,
  routes: [] as unknown[],
  summary: { totalRoutes: 0, passedRoutes: 0, result: 'PASS' as 'PASS' | 'FAIL' },
};

for (const route of ROUTES) {
  let correct = 0;
  let penetrations = 0;
  let teleports = 0;
  let outOfBounds = 0;
  let frozenInAir = 0;
  let pusherContacts = 0;
  const finals: string[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const r = simulateDrop(route.sku, route.zone);
    if (r.insideExpectedReceiver) correct += 1;
    if (r.minClearanceM < -PENETRATION_DEPTH) penetrations += 1;
    if (r.maxSpeedMps > SPEED_TELEPORT_CAP) teleports += 1;
    const [x, y, z] = r.finalPosition;
    if (x < BOUNDS.x[0] || x > BOUNDS.x[1] || y < BOUNDS.y[0] || y > BOUNDS.y[1] || z < BOUNDS.z[0] || z > BOUNDS.z[1]) {
      outOfBounds += 1;
    }
    // Frozen in air: settled above floor level but NOT inside the receiver.
    if (!r.insideExpectedReceiver && y > 0.4) frozenInAir += 1;
    if (r.pusherContactMade) pusherContacts += 1;
    if (run < 3) finals.push(`(${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)})`);
  }
  const pass = correct === RUNS && penetrations === 0 && teleports === 0 && outOfBounds === 0 && frozenInAir === 0
    && (route.zone === 'B' || pusherContacts === RUNS);
  report.routes.push({
    sku: route.sku,
    route: route.label,
    expectedZone: route.zone,
    runs: RUNS,
    correctLandings: correct,
    penetrations,
    teleports,
    outOfBounds,
    frozenInAir,
    pusherContacts: route.zone === 'B' ? 'n/a' : pusherContacts,
    sampleFinalPositions: finals,
    result: pass ? 'PASS' : 'FAIL',
  });
  report.summary.totalRoutes += 1;
  if (pass) report.summary.passedRoutes += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${route.label} (${route.sku}): ${correct}/${RUNS} landings, pen=${penetrations}, tp=${teleports}, oob=${outOfBounds}, air=${frozenInAir}, pusher=${route.zone === 'B' ? 'n/a' : pusherContacts}`);
}

if (report.summary.passedRoutes !== report.summary.totalRoutes) report.summary.result = 'FAIL';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`\n${report.summary.passedRoutes}/${report.summary.totalRoutes} routes PASS -> ${OUT}`);
process.exit(report.summary.result === 'PASS' ? 0 : 1);
