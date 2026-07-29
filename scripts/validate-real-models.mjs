#!/usr/bin/env node
/**
 * Stage 1 — automated real-model validation.
 *
 * Reads the manifest (src/data/modelAssets.ts, transpiled with the project's
 * typescript dep), then for every SKU independently:
 *   - checks the runtime file exists (size + SHA-256 vs manifest)
 *   - parses the STL, applies manifest rotation + uniform mm scale
 *   - measures the world-axis bounding box
 *   - compares against worldExpectedMm with tolerance max(2mm, 1%) per axis
 *   - checks triangle/file budgets
 *   - verifies honest marking for SKUs without an official model
 *
 * Output: docs/stage1_real_models/real-models-validation.json
 * Exit code: non-zero on any critical failure. Never hand-edited results.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = resolve(ROOT, 'docs/stage1_real_models/real-models-validation.json');

// ---------- manifest loading (TS → ESM via typescript transpile) ----------
async function loadManifest() {
  const src = readFileSync(resolve(ROOT, 'src/data/modelAssets.ts'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const tmp = resolve(ROOT, 'node_modules/.cache/modelAssets.manifest.mjs');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, js);
  const mod = await import(`file://${tmp}?t=${Date.now()}`);
  return { MODEL_ASSETS: mod.MODEL_ASSETS, ARCHIVE_ONLY_MODELS: mod.ARCHIVE_ONLY_MODELS };
}

// ---------- STL parsing + transform measurement ----------
function readStlVertices(path) {
  const buf = readFileSync(path);
  const isAscii = buf.subarray(0, 5).toString('ascii').toLowerCase() === 'solid'
    && !(buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length);
  const verts = [];
  if (isAscii) {
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    const text = buf.toString('ascii');
    let m;
    while ((m = re.exec(text)) !== null) verts.push([+m[1], +m[2], +m[3]]);
    return { verts, triCount: verts.length / 3, bytes: buf.length };
  }
  const count = buf.readUInt32LE(80);
  for (let i = 0; i < count; i++) {
    const off = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v++) {
      verts.push([buf.readFloatLE(off + v * 12), buf.readFloatLE(off + v * 12 + 4), buf.readFloatLE(off + v * 12 + 8)]);
    }
  }
  return { verts, triCount: count, bytes: buf.length };
}

/** Apply manifest rotation (X→Y→Z order, same as three.js geometry.rotate*) */
function rotatePoint([x, y, z], [rx, ry, rz]) {
  if (rx) {
    const c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (rz) {
    const c = Math.cos(rz), s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const TOL_ABS_MM = 2;
const TOL_REL = 0.01;
const FILE_HARD_LIMIT = 1.5 * 1024 * 1024;
const TRI_ACCEPTABLE = 100_000;
const r2 = (n) => Math.round(n * 100) / 100;

const { MODEL_ASSETS, ARCHIVE_ONLY_MODELS } = await loadManifest();
const results = [];
let failures = 0;

for (const asset of MODEL_ASSETS) {
  const base = {
    sku: asset.itemId,
    model: asset.displayName,
    source: asset.sourceFile ? `${asset.sourceArchive} → ${asset.sourceFile}` : null,
    sourceSha256: asset.sourceSha256,
    runtimePath: asset.runtimePath,
    format: asset.runtimeFormat,
    expectedDimensionsMm: asset.dimensions,
    axisMapping: asset.axisMapping,
    rotation: asset.rotation,
    pivot: asset.pivotMode,
    defaultRealAsset: asset.defaultRealAsset,
  };

  if (!asset.defaultRealAsset) {
    const honest = (asset.notes ?? '').includes('NO_EXACT_OFFICIAL_MODEL');
    if (!honest) failures++;
    results.push({
      ...base,
      status: honest ? 'PASS' : 'FAIL',
      mode: 'procedural-fallback',
      honestMarking: honest,
      withinTolerance: null,
    });
    continue;
  }

  const diskPath = resolve(ROOT, 'public', asset.runtimePath.replace(/^\//, ''));
  const record = { ...base, mode: 'real-model' };

  if (!existsSync(diskPath)) {
    failures++;
    results.push({ ...record, status: 'FAIL', error: 'RUNTIME_FILE_MISSING' });
    continue;
  }

  const actualSha = sha256(diskPath);
  record.checksumMatch = actualSha === asset.runtimeSha256;
  const { verts, triCount, bytes } = readStlVertices(diskPath);
  record.fileSizeBytes = bytes;
  record.triangleCount = triCount;
  record.fileSizeMatchesManifest = bytes === asset.fileSizeBytes;
  record.triangleCountMatchesManifest = triCount === asset.triangleCount;

  // world-space measurement after manifest rotation (mm)
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of verts) {
    const w = rotatePoint(p, asset.rotation);
    for (let a = 0; a < 3; a++) {
      if (w[a] < min[a]) min[a] = w[a];
      if (w[a] > max[a]) max[a] = w[a];
    }
  }
  const measuredMm = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  const expected = asset.worldExpectedMm;
  const deviationMm = {};
  const deviationPercent = {};
  let withinTolerance = true;
  for (const axis of ['x', 'y', 'z']) {
    const dev = Math.abs(measuredMm[axis] - expected[axis]);
    const tol = Math.max(TOL_ABS_MM, expected[axis] * TOL_REL);
    deviationMm[axis] = r2(dev);
    deviationPercent[axis] = r2((dev / expected[axis]) * 100);
    if (dev > tol) withinTolerance = false;
  }
  record.expectedWorldMm = expected;
  record.measuredDimensionsMm = { x: r2(measuredMm.x), y: r2(measuredMm.y), z: r2(measuredMm.z) };
  record.deviationMm = deviationMm;
  record.deviationPercent = deviationPercent;
  record.uniformScale = 1.0; // mm→m uniform only; no fitting scale
  record.withinTolerance = withinTolerance;
  record.budget = {
    fileUnderHardLimit: bytes <= FILE_HARD_LIMIT,
    trianglesUnderAcceptable: triCount <= TRI_ACCEPTABLE,
  };

  const pass = record.checksumMatch
    && record.fileSizeMatchesManifest
    && record.triangleCountMatchesManifest
    && withinTolerance
    && record.budget.fileUnderHardLimit
    && record.budget.trianglesUnderAcceptable;
  if (!pass) failures++;
  record.status = pass ? 'PASS' : 'FAIL';
  results.push(record);
}

const summary = {
  generatedAt: new Date().toISOString(),
  toleranceRule: 'max(2mm, 1%) per axis, uniform scale only',
  budgets: { fileHardLimitBytes: FILE_HARD_LIMIT, trianglesAcceptable: TRI_ACCEPTABLE },
  totals: {
    skus: MODEL_ASSETS.length,
    realAssets: results.filter((r) => r.mode === 'real-model').length,
    proceduralFallbacks: results.filter((r) => r.mode === 'procedural-fallback').length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
  },
  archiveOnlyModels: ARCHIVE_ONLY_MODELS.map((m) => ({
    model: m.displayName,
    source: `${m.sourceArchive} → ${m.sourceFile}`,
    sourceSha256: m.sourceSha256,
    note: m.notes,
  })),
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary.totals));
for (const r of results) {
  const tag = r.status === 'PASS' ? 'PASS' : 'FAIL';
  const dims = r.measuredDimensionsMm
    ? ` measured=${r.measuredDimensionsMm.x}/${r.measuredDimensionsMm.y}/${r.measuredDimensionsMm.z}mm`
    : '';
  console.log(`${tag} ${r.sku}${dims}${r.error ? ' ' + r.error : ''}`);
}
if (failures > 0) {
  console.error(`\n${failures} critical failure(s)`);
  process.exit(1);
}
console.log('\nAll validations passed.');
