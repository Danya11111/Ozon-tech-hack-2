#!/usr/bin/env node
/**
 * Autonomous improvement agent MVP — Orchestrator shell.
 *
 * Modes: dry-run | run-once | status | stop | resume | pause | report
 * NEVER merges to main or deploys production.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATE_DIR = join(ROOT, 'agent', 'state');
const REPORTS_DIR = join(ROOT, 'agent', 'reports');
const KILL_SWITCH = join(STATE_DIR, 'KILL');
const STATUS_FILE = join(STATE_DIR, 'status.json');
const AUDIT_LOG = join(STATE_DIR, 'audit.jsonl');

const LIMITS = {
  maxCycleMinutes: 25,
  maxChangedFiles: 12,
  maxDiffLines: 800,
  maxParallelWorkers: 1,
  dailyLlmBudgetUsd: 5,
  forbidMergeToMain: true,
  forbidProductionDeploy: true,
  forbidSecretAccess: true,
  requireTestsPass: true,
  requireBuildPass: true,
  minScoreDelta: 0,
};

function ensureDirs() {
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function audit(event, payload = {}) {
  appendFileSync(AUDIT_LOG, `${JSON.stringify({ ts: nowIso(), event, ...payload })}\n`);
}

function writeStatus(status) {
  writeFileSync(STATUS_FILE, JSON.stringify({ ...status, updatedAt: nowIso() }, null, 2));
}

function readStatus() {
  if (!existsSync(STATUS_FILE)) return { state: 'idle' };
  return JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
}

function isKilled() {
  return existsSync(KILL_SWITCH);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
    env: { ...process.env, AGENT_MODE: '1' },
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function collectBaseline() {
  const tests = run('npm', ['test']);
  const build = run('npm', ['run', 'build']);
  return {
    testsPassed: tests.code === 0,
    buildPassed: build.code === 0,
    testOutputTail: tests.stdout.split('\n').slice(-20).join('\n'),
    buildOutputTail: build.stdout.split('\n').slice(-20).join('\n'),
  };
}

function proposeTasks(baseline) {
  const backlog = [
    {
      id: 'unify-classifier-proof',
      title: 'Keep classifyItem as single decision source on main demo',
      impact: 9,
      risk: 2,
    },
    {
      id: 'safety-playlist',
      title: 'Jam / E-stop visible on main playlist',
      impact: 8,
      risk: 3,
    },
    {
      id: 'demo-hotkeys',
      title: 'Presenter seek/speed/presentation hotkeys',
      impact: 7,
      risk: 2,
    },
    {
      id: 'perf-quality-modes',
      title: 'Adaptive quality modes for demo FPS',
      impact: 6,
      risk: 2,
    },
  ];

  if (!baseline.testsPassed || !baseline.buildPassed) {
    return {
      id: 'stabilize-baseline',
      title: 'Restore green tests/build before further changes',
      impact: 10,
      risk: 1,
    };
  }

  return backlog.sort((a, b) => b.impact - a.impact)[0];
}

function scoreCategories(baseline, notes) {
  const categories = {
    visualRealism: 72,
    physicsFidelity: 68,
    demoClarity: 80,
    technicalStability: baseline.testsPassed && baseline.buildPassed ? 88 : 40,
    performance: 78,
    faultTolerance: 75,
    architecture: 76,
    testCoverage: 82,
    launchConvenience: 84,
    logging: 74,
    security: 90,
    hardwareFit: 86,
  };
  const values = Object.values(categories);
  const total = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { categories, total, notes };
}

function writeReport(runId, report) {
  const path = join(REPORTS_DIR, `${runId}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  writeFileSync(join(REPORTS_DIR, 'latest.json'), JSON.stringify(report, null, 2));
  return path;
}

function cmdDryRun() {
  ensureDirs();
  if (isKilled()) {
    console.error('Kill switch active. Remove agent/state/KILL to continue.');
    process.exit(2);
  }
  const runId = `dry-${Date.now()}`;
  writeStatus({ state: 'dry-run', runId });
  audit('dry_run_start', { runId });

  console.log(`[agent] dry-run ${runId}`);
  console.log('[agent] collecting baseline (tests + build)...');
  const baseline = collectBaseline();
  const task = proposeTasks(baseline);
  const score = scoreCategories(baseline, 'dry-run — no code changes');

  const report = {
    runId,
    mode: 'dry-run',
    hypothesis: `If we execute "${task.title}", demo jury clarity improves without regressing FPS.`,
    task,
    limits: LIMITS,
    baseline,
    score,
    decision: 'PLAN_ONLY',
    reason: 'dry-run does not apply patches',
    safety: {
      wouldTouchProduction: false,
      wouldMergeMain: false,
      killSwitch: false,
    },
  };

  const path = writeReport(runId, report);
  writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'dry-run' });
  audit('dry_run_complete', { runId, path, taskId: task.id });
  console.log(`[agent] planned task: ${task.id} — ${task.title}`);
  console.log(`[agent] score: ${score.total}/100`);
  console.log(`[agent] report: ${path}`);
}

function cmdRunOnce() {
  ensureDirs();
  if (isKilled()) {
    console.error('Kill switch active.');
    process.exit(2);
  }
  const runId = `once-${Date.now()}`;
  writeStatus({ state: 'run-once', runId });
  audit('run_once_start', { runId });

  console.log(`[agent] run-once ${runId}`);
  console.log('[agent] MVP policy: verify baseline only — no automatic code mutation.');

  const baseline = collectBaseline();
  const task = proposeTasks(baseline);
  const score = scoreCategories(baseline, 'run-once verification');
  const decision =
    baseline.testsPassed && baseline.buildPassed ? 'ACCEPT_BASELINE' : 'REJECT_BASELINE';

  const report = {
    runId,
    mode: 'run-once',
    task,
    limits: LIMITS,
    baseline,
    score,
    decision,
    reason:
      decision === 'ACCEPT_BASELINE'
        ? 'Tests and build green; agent will not auto-patch in MVP (requires human Implementer).'
        : 'Baseline red — agent refuses further patches until fixed.',
    nextSafeActions: [
      'Keep working on feature/maximum-demo-realism',
      'Never merge to main automatically',
      'Use agent dry-run before long autonomous sessions',
    ],
  };

  const path = writeReport(runId, report);
  writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'run-once', decision });
  audit('run_once_complete', { runId, decision });
  console.log(`[agent] decision: ${decision}`);
  console.log(`[agent] report: ${path}`);
  process.exit(decision === 'ACCEPT_BASELINE' ? 0 : 1);
}

function cmdStatus() {
  ensureDirs();
  console.log(JSON.stringify({ ...readStatus(), killSwitch: isKilled(), limits: LIMITS }, null, 2));
}

function cmdStop() {
  ensureDirs();
  writeFileSync(KILL_SWITCH, `stopped at ${nowIso()}\n`);
  writeStatus({ state: 'stopped' });
  audit('kill_switch_on');
  console.log('[agent] stop requested — kill switch written');
}

function cmdResume() {
  ensureDirs();
  if (existsSync(KILL_SWITCH)) unlinkSync(KILL_SWITCH);
  writeStatus({ state: 'idle' });
  audit('kill_switch_off');
  console.log('[agent] resumed');
}

function cmdPause() {
  writeStatus({ ...readStatus(), state: 'paused' });
  audit('paused');
  console.log('[agent] paused');
}

function cmdReport() {
  ensureDirs();
  const latest = join(REPORTS_DIR, 'latest.json');
  if (!existsSync(latest)) {
    console.error('No report yet. Run: node agent/cli.mjs dry-run');
    process.exit(1);
  }
  console.log(readFileSync(latest, 'utf8'));
}

const cmd = process.argv[2] ?? 'status';
switch (cmd) {
  case 'dry-run':
    cmdDryRun();
    break;
  case 'run-once':
    cmdRunOnce();
    break;
  case 'status':
    cmdStatus();
    break;
  case 'stop':
    cmdStop();
    break;
  case 'resume':
    cmdResume();
    break;
  case 'pause':
    cmdPause();
    break;
  case 'report':
    cmdReport();
    break;
  case 'start':
    console.log('[agent] continuous start disabled in MVP. Use: dry-run | run-once');
    process.exit(1);
    break;
  default:
    console.log('Usage: node agent/cli.mjs <dry-run|run-once|status|stop|resume|pause|report>');
    process.exit(1);
}
