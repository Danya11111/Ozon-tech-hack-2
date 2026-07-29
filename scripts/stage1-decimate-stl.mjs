#!/usr/bin/env node
/**
 * Stage 1 — reproducible STL decimation (vertex clustering).
 *
 * No external dependencies. Clusters vertices on a uniform grid, welds
 * duplicates, drops degenerate triangles, recomputes flat face normals,
 * writes binary STL. Bounding box is preserved within one grid cell
 * (verified by validate-real-models.mjs afterwards).
 *
 * Usage:
 *   node scripts/stage1-decimate-stl.mjs <in.stl> <out.stl> <cellSizeMm>
 *
 * Deterministic: same input + same cell size => byte-identical output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeSTL } from './stage1-analyze-stl.mjs';

const [inPath, outPath, cellArg] = process.argv.slice(2);
if (!inPath || !outPath || !cellArg) {
  console.error('usage: node scripts/stage1-decimate-stl.mjs <in.stl> <out.stl> <cellSizeMm>');
  process.exit(2);
}
const cell = Number(cellArg);
if (!(cell > 0)) {
  console.error('cellSizeMm must be > 0');
  process.exit(2);
}

// --- read source (binary or ascii) into flat triangle soup ---
function readTriangles(path) {
  const buf = readFileSync(path);
  const isAscii = buf.subarray(0, 5).toString('ascii').toLowerCase() === 'solid'
    && !(buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length);
  const verts = [];
  if (isAscii) {
    const text = buf.toString('ascii');
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
  } else {
    const count = buf.readUInt32LE(80);
    for (let i = 0; i < count; i++) {
      const off = 84 + i * 50 + 12;
      for (let v = 0; v < 3; v++) {
        verts.push(
          buf.readFloatLE(off + v * 12),
          buf.readFloatLE(off + v * 12 + 4),
          buf.readFloatLE(off + v * 12 + 8),
        );
      }
    }
  }
  return verts;
}

const verts = readTriangles(inPath);
const srcTriCount = verts.length / 9;

// --- vertex clustering weld ---
const keyOf = (x, y, z) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
const clusterIndex = new Map();
const clustered = []; // representative vertex per cluster (first occurrence, stable)
const remap = new Uint32Array(verts.length / 3);
for (let i = 0; i < verts.length; i += 3) {
  const key = keyOf(verts[i], verts[i + 1], verts[i + 2]);
  let idx = clusterIndex.get(key);
  if (idx === undefined) {
    idx = clustered.length / 3;
    clusterIndex.set(key, idx);
    clustered.push(verts[i], verts[i + 1], verts[i + 2]);
  }
  remap[i / 3] = idx;
}

// --- rebuild triangles, drop degenerates ---
const outTris = [];
for (let t = 0; t < srcTriCount; t++) {
  const a = remap[t * 3];
  const b = remap[t * 3 + 1];
  const c = remap[t * 3 + 2];
  if (a === b || b === c || a === c) continue;
  outTris.push(a, b, c);
}
const outTriCount = outTris.length / 3;

// --- write binary STL with recomputed flat normals ---
const header = Buffer.alloc(80);
header.write(`decimated(cell=${cell}mm) ${srcTriCount}->${outTriCount} tris`);
const body = Buffer.alloc(4 + outTriCount * 50);
body.writeUInt32LE(outTriCount, 0);
for (let t = 0; t < outTriCount; t++) {
  const base = 4 + t * 50;
  const [a, b, c] = [outTris[t * 3] * 3, outTris[t * 3 + 1] * 3, outTris[t * 3 + 2] * 3];
  const ax = clustered[a], ay = clustered[a + 1], az = clustered[a + 2];
  const bx = clustered[b], by = clustered[b + 1], bz = clustered[b + 2];
  const cx = clustered[c], cy = clustered[c + 1], cz = clustered[c + 2];
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  body.writeFloatLE(nx, base);
  body.writeFloatLE(ny, base + 4);
  body.writeFloatLE(nz, base + 8);
  const vs = [ax, ay, az, bx, by, bz, cx, cy, cz];
  vs.forEach((v, i) => body.writeFloatLE(v, base + 12 + i * 4));
  body.writeUInt16LE(0, base + 48);
}
writeFileSync(outPath, Buffer.concat([header, body]));

const after = analyzeSTL(outPath);
console.log(JSON.stringify({
  input: inPath,
  output: outPath,
  cellSizeMm: cell,
  trianglesBefore: srcTriCount,
  trianglesAfter: outTriCount,
  fileSizeAfter: after.fileSizeBytes,
  sizeMmAfter: after.size,
}, null, 2));
