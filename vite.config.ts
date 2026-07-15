import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BuildVersionInfo {
  commit: string;
  branch: string;
  builtAt: string;
  release: string;
}

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function resolveBuildVersion(): BuildVersionInfo {
  const commit =
    process.env.VITE_BUILD_COMMIT ||
    process.env.BUILD_COMMIT ||
    git('git rev-parse --short HEAD') ||
    'unknown';
  const branch =
    process.env.VITE_BUILD_BRANCH ||
    process.env.BUILD_BRANCH ||
    git('git rev-parse --abbrev-ref HEAD') ||
    'unknown';
  const release =
    process.env.VITE_BUILD_RELEASE ||
    process.env.BUILD_RELEASE ||
    process.env.RELEASE ||
    '';
  return {
    commit: commit.replace(/^v/, '').slice(0, 40),
    branch,
    builtAt: new Date().toISOString(),
    release: release || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
  };
}

/** Emits /version.json into dist (and public during build) — no secrets/paths. */
function versionJsonPlugin(): Plugin {
  return {
    name: 'emit-version-json',
    apply: 'build',
    buildStart() {
      const info = resolveBuildVersion();
      const publicDir = resolve(process.cwd(), 'public');
      mkdirSync(publicDir, { recursive: true });
      writeFileSync(resolve(publicDir, 'version.json'), `${JSON.stringify(info, null, 2)}\n`);
    },
    closeBundle() {
      const info = resolveBuildVersion();
      const out = resolve(process.cwd(), 'dist', 'version.json');
      writeFileSync(out, `${JSON.stringify(info, null, 2)}\n`);
      // eslint-disable-next-line no-console
      console.log(`[version] ${info.commit} @ ${info.branch} release=${info.release}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3100,
  },
});
