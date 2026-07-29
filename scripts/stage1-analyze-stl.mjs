#!/usr/bin/env node
/**
 * Stage 1 — dependency-free STL analyzer.
 * Parses binary (and ASCII) STL, reports triangle count, bounding box,
 * file size, and a units guess. Used for source measurement and validation.
 *
 * Usage: node scripts/stage1-analyze-stl.mjs <file.stl> [more.stl...]
 */
import { readFileSync } from 'node:fs';

export function analyzeSTL(path) {
  const buf = readFileSync(path);
  const isAscii = buf.subarray(0, 5).toString('ascii').toLowerCase() === 'solid'
    && !looksBinary(buf);
  const tris = [];
  if (isAscii) {
    const text = buf.toString('ascii');
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      tris.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    }
  } else {
    const count = buf.readUInt32LE(80);
    for (let i = 0; i < count; i++) {
      const off = 84 + i * 50 + 12; // skip normal
      for (let v = 0; v < 3; v++) {
        tris.push([
          buf.readFloatLE(off + v * 12),
          buf.readFloatLE(off + v * 12 + 4),
          buf.readFloatLE(off + v * 12 + 8),
        ]);
      }
    }
  }
  const triCount = isAscii ? tris.length / 3 : buf.readUInt32LE(80);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of tris) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a];
      if (p[a] > max[a]) max[a] = p[a];
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return {
    file: path,
    format: isAscii ? 'ascii' : 'binary',
    fileSizeBytes: buf.length,
    triangleCount: triCount,
    bboxMin: min.map(round3),
    bboxMax: max.map(round3),
    size: size.map(round3),
  };
}

function looksBinary(buf) {
  if (buf.length < 84) return false;
  const count = buf.readUInt32LE(80);
  return 84 + count * 50 === buf.length;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

if (process.argv[1] && process.argv[1].endsWith('stage1-analyze-stl.mjs')) {
  const out = [];
  for (const f of process.argv.slice(2)) {
    out.push(analyzeSTL(f));
  }
  console.log(JSON.stringify(out, null, 2));
}
