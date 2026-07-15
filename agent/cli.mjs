#!/usr/bin/env node
/**
 * Autonomous improvement agent — Implementer MVP.
 *
 * Modes: dry-run | run-once | implement | start | status | stop | resume | pause | report
 * NEVER merges to main, NEVER deploys production, NEVER pushes.
 * No external LLM required — deterministic local demo-task path.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
  rmSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { cpus, freemem, totalmem, loadavg } from 'node:os';
import { dirname, join, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATE_DIR = join(ROOT, 'agent', 'state');
const REPORTS_DIR = join(ROOT, 'agent', 'reports');
const TASKS_DIR = join(ROOT, 'agent', 'tasks');
const WORKTREES_DIR = join(ROOT, '.agent', 'worktrees');
const KILL_SWITCH = join(STATE_DIR, 'KILL');
const LOCK_FILE = join(STATE_DIR, 'agent.lock');
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
  maxDiskUsagePercent: 85,
  minMemAvailableGiB: 1,
};

/** Policy allowlist for Implementer patches (no LLM needed). */
const POLICY_ALLOWLIST = [
  'docs',
  'tests',
  'data-testid',
  'a11y',
  'small-ui',
  'logging-scripts',
];

const FORBIDDEN_PATH_PREFIXES = [
  '.env',
  'docker',
  'nginx',
  'deploy',
  'releases/',
];

const DEFAULT_TASK_PATH = join(TASKS_DIR, 'demo-docs.json');

const DEMO_DOCS_CONTENT = `# Agent Cycle Demo

This file was created by the Implementer MVP as a **safe, docs-only** demonstration patch.

- Worktree-isolated (never applied to production automatically)
- Policy category: \`docs\`
- No merge, no deploy, no push

Generated at: {{TIMESTAMP}}
Run id: {{RUN_ID}}

## Manual review

1. Inspect the worktree and branch named in the cycle report.
2. If acceptable, copy or cherry-pick into your feature branch yourself.
3. Never let the agent merge to \`main\` or deploy.
`;

function ensureDirs() {
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(TASKS_DIR, { recursive: true });
  mkdirSync(WORKTREES_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function audit(event, payload = {}) {
  ensureDirs();
  appendFileSync(AUDIT_LOG, `${JSON.stringify({ ts: nowIso(), event, ...payload })}\n`);
}

function writeStatus(status) {
  ensureDirs();
  writeFileSync(STATUS_FILE, JSON.stringify({ ...status, updatedAt: nowIso() }, null, 2));
}

function readStatus() {
  if (!existsSync(STATUS_FILE)) return { state: 'idle' };
  return JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
}

function isKilled() {
  return existsSync(KILL_SWITCH);
}

function assertNotKilled() {
  if (isKilled()) {
    console.error('Kill switch active. Remove agent/state/KILL (or run: resume) to continue.');
    process.exit(2);
  }
}

function run(cmd, args, opts = {}) {
  const cwd = opts.cwd ?? ROOT;
  const timeout = opts.timeout ?? 15 * 60 * 1000;
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, AGENT_MODE: '1' },
  });
  return {
    code: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error.message || result.error) : null,
    signal: result.signal ?? null,
  };
}

function git(args, opts = {}) {
  return run('git', args, opts);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'task';
}

/* ─── Watchdog ─────────────────────────────────────────────── */

function readMemAvailableBytes() {
  try {
    const meminfo = readFileSync('/proc/meminfo', 'utf8');
    const m = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    if (m) return Number(m[1]) * 1024;
  } catch {
    /* fall through */
  }
  return freemem();
}

function diskUsagePercent(mount = '/') {
  const result = run('df', ['-P', mount]);
  if (result.code !== 0) {
    return { ok: false, reason: `df failed: ${result.stderr || result.error}` };
  }
  const lines = result.stdout.trim().split('\n');
  const data = lines[lines.length - 1]?.trim().split(/\s+/);
  // df -P: Filesystem 1024-blocks Used Available Capacity Mounted
  const capacity = data?.[4];
  if (!capacity) return { ok: false, reason: 'could not parse df output' };
  const pct = Number(String(capacity).replace('%', ''));
  if (Number.isNaN(pct)) return { ok: false, reason: `invalid capacity: ${capacity}` };
  return { ok: true, percent: pct, mount };
}

function watchdogChecks() {
  const failures = [];

  if (isKilled()) {
    failures.push('kill switch active (agent/state/KILL)');
  }

  const disk = diskUsagePercent('/');
  if (!disk.ok) {
    failures.push(`disk check failed: ${disk.reason}`);
  } else if (disk.percent > LIMITS.maxDiskUsagePercent) {
    failures.push(`disk usage ${disk.percent}% > ${LIMITS.maxDiskUsagePercent}% on ${disk.mount}`);
  }

  const nproc = Math.max(cpus().length, 1);
  const load1 = loadavg()[0];
  if (load1 > nproc) {
    failures.push(`loadavg 1m ${load1.toFixed(2)} > nproc ${nproc}`);
  }

  const memAvail = readMemAvailableBytes();
  const minBytes = LIMITS.minMemAvailableGiB * 1024 ** 3;
  if (memAvail < minBytes) {
    const availGiB = (memAvail / 1024 ** 3).toFixed(2);
    failures.push(`MemAvailable ${availGiB} GiB < ${LIMITS.minMemAvailableGiB} GiB`);
  }

  return {
    ok: failures.length === 0,
    failures,
    snapshot: {
      diskPercent: disk.ok ? disk.percent : null,
      load1,
      nproc,
      memAvailableBytes: memAvail,
      memAvailableGiB: Number((memAvail / 1024 ** 3).toFixed(3)),
      totalMemGiB: Number((totalmem() / 1024 ** 3).toFixed(3)),
      killSwitch: isKilled(),
    },
  };
}

function pidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(runId) {
  ensureDirs();
  if (existsSync(LOCK_FILE)) {
    let existing = null;
    try {
      existing = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    } catch {
      existing = null;
    }
    if (existing?.pid && pidAlive(existing.pid)) {
      console.error(
        `[agent] refuse: another agent is running (pid ${existing.pid}, runId ${existing.runId ?? '?'}).`,
      );
      console.error(`[agent] lock: ${LOCK_FILE}`);
      process.exit(1);
    }
    console.warn('[agent] stale lock found — taking over');
    audit('lock_stale_takeover', { previous: existing });
  }

  const lock = {
    pid: process.pid,
    runId,
    startedAt: nowIso(),
    cwd: ROOT,
  };
  writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2));
  audit('lock_acquired', lock);
  return lock;
}

function releaseLock() {
  if (!existsSync(LOCK_FILE)) return;
  try {
    const existing = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    if (existing.pid && existing.pid !== process.pid && pidAlive(existing.pid)) {
      console.warn('[agent] lock owned by another pid — not releasing');
      return;
    }
  } catch {
    /* remove anyway if unreadable and ours */
  }
  try {
    unlinkSync(LOCK_FILE);
    audit('lock_released', { pid: process.pid });
  } catch {
    /* ignore */
  }
}

/* ─── Baseline / scoring (shared with dry-run / run-once) ───── */

function collectBaseline(cwd = ROOT) {
  const tests = run('npm', ['test'], { cwd });
  const build = run('npm', ['run', 'build'], { cwd });
  return {
    testsPassed: tests.code === 0,
    buildPassed: build.code === 0,
    testOutputTail: (tests.stdout || tests.stderr).split('\n').slice(-20).join('\n'),
    buildOutputTail: (build.stdout || build.stderr).split('\n').slice(-20).join('\n'),
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
  ensureDirs();
  const path = join(REPORTS_DIR, `${runId}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  writeFileSync(join(REPORTS_DIR, 'latest.json'), JSON.stringify(report, null, 2));
  return path;
}

/* ─── Task loading & policy ─────────────────────────────────── */

function loadTaskFile(taskPath) {
  const abs = resolve(ROOT, taskPath);
  if (!existsSync(abs)) {
    throw new Error(`Task file not found: ${abs}`);
  }
  const task = JSON.parse(readFileSync(abs, 'utf8'));
  if (!task.id || !task.title) {
    throw new Error('Task file must include id and title');
  }
  task.slug = task.slug || slugify(task.id);
  task.policyCategory = task.policyCategory || task.category || 'docs';
  task._sourcePath = abs;
  return task;
}

function defaultDemoTask() {
  if (existsSync(DEFAULT_TASK_PATH)) {
    return loadTaskFile(DEFAULT_TASK_PATH);
  }
  return {
    id: 'demo-docs',
    title: 'Add agent cycle demo documentation',
    slug: 'demo-docs',
    policyCategory: 'docs',
    description: 'Safe docs-only demo patch for Implementer MVP (no LLM).',
    allowPaths: ['docs/AGENT_CYCLE_DEMO.md'],
    patch: {
      type: 'create-file',
      path: 'docs/AGENT_CYCLE_DEMO.md',
      contentTemplate: 'builtin-demo-docs',
    },
  };
}

function validateTaskPolicy(task) {
  const errors = [];
  const category = task.policyCategory || task.category;
  if (!POLICY_ALLOWLIST.includes(category)) {
    errors.push(
      `policy category "${category}" not in allowlist: ${POLICY_ALLOWLIST.join(', ')}`,
    );
  }

  const paths = [];
  if (Array.isArray(task.allowPaths)) paths.push(...task.allowPaths);
  if (task.patch?.path) paths.push(task.patch.path);
  if (Array.isArray(task.patch?.files)) {
    for (const f of task.patch.files) {
      if (f.path) paths.push(f.path);
    }
  }

  for (const p of paths) {
    const norm = p.replace(/\\/g, '/');
    if (norm.includes('..')) {
      errors.push(`path escapes not allowed: ${p}`);
      continue;
    }
    for (const bad of FORBIDDEN_PATH_PREFIXES) {
      if (norm === bad || norm.startsWith(bad) || basename(norm) === '.env') {
        errors.push(`forbidden path: ${p}`);
      }
    }
    if (category === 'docs' && !norm.startsWith('docs/')) {
      errors.push(`docs policy requires path under docs/: ${p}`);
    }
    if (category === 'tests' && !(norm.startsWith('src/') || norm.includes('.test.') || norm.includes('.spec.') || norm.startsWith('tests/'))) {
      errors.push(`tests policy path looks unsafe: ${p}`);
    }
    if (category === 'logging-scripts' && !norm.startsWith('scripts/')) {
      errors.push(`logging-scripts policy requires scripts/: ${p}`);
    }
  }

  if (task.requiresLlm) {
    errors.push('tasks requiring external LLM are not supported in this MVP');
  }

  return { ok: errors.length === 0, errors, category, paths };
}

function resolvePatchContent(task, runId) {
  const patch = task.patch || {};
  if (patch.content) return patch.content;
  if (patch.contentTemplate === 'builtin-demo-docs' || !patch.content) {
    return DEMO_DOCS_CONTENT.replaceAll('{{TIMESTAMP}}', nowIso()).replaceAll(
      '{{RUN_ID}}',
      runId,
    );
  }
  return String(patch.content);
}

/* ─── Worktree + patch ──────────────────────────────────────── */

function ensureNodeModulesLink(worktreePath) {
  const target = join(worktreePath, 'node_modules');
  const source = join(ROOT, 'node_modules');
  if (!existsSync(source)) {
    throw new Error('Root node_modules missing — run npm install in repo root first');
  }
  if (existsSync(target)) {
    try {
      const st = lstatSync(target);
      if (st.isSymbolicLink() || st.isDirectory()) return;
    } catch {
      /* recreate below */
    }
  }
  symlinkSync(source, target, 'dir');
}

function createWorktree(runId, taskSlug) {
  mkdirSync(WORKTREES_DIR, { recursive: true });
  const worktreePath = join(WORKTREES_DIR, runId);
  const branch = `agent/${runId}/${taskSlug}`;

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  // Drop leftover branch name if present (safe local delete only).
  const branchCheck = git(['rev-parse', '--verify', branch]);
  if (branchCheck.code === 0) {
    git(['branch', '-D', branch]);
  }

  const add = git(['worktree', 'add', '-b', branch, worktreePath, 'HEAD']);
  if (add.code !== 0) {
    throw new Error(`git worktree add failed: ${add.stderr || add.stdout || add.error}`);
  }

  ensureNodeModulesLink(worktreePath);
  return { worktreePath, branch };
}

function applyBoundedPatch(worktreePath, task, runId) {
  const patch = task.patch || { type: 'create-file', path: 'docs/AGENT_CYCLE_DEMO.md' };
  const type = patch.type || 'create-file';
  const changed = [];

  if (type === 'create-file' || type === 'write-file') {
    const rel = patch.path || 'docs/AGENT_CYCLE_DEMO.md';
    const abs = join(worktreePath, rel);
    mkdirSync(dirname(abs), { recursive: true });
    const content = resolvePatchContent(task, runId);
    writeFileSync(abs, content);
    changed.push(rel);
  } else if (type === 'multi' && Array.isArray(patch.files)) {
    for (const f of patch.files) {
      const abs = join(worktreePath, f.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.content ?? '');
      changed.push(f.path);
    }
  } else {
    throw new Error(`Unsupported patch type: ${type}`);
  }

  const add = git(['add', '--', ...changed], { cwd: worktreePath });
  if (add.code !== 0) {
    throw new Error(`git add failed: ${add.stderr || add.stdout}`);
  }

  const commit = git(
    ['commit', '-m', `agent(${runId}): ${task.id} — safe implementer demo`],
    { cwd: worktreePath },
  );
  if (commit.code !== 0) {
    throw new Error(`git commit failed: ${commit.stderr || commit.stdout}`);
  }

  return changed;
}

function measureDiff(worktreePath, baseRef = 'HEAD~1') {
  const nameOnly = git(['diff', '--name-only', baseRef, 'HEAD'], { cwd: worktreePath });
  const files = nameOnly.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const numstat = git(['diff', '--numstat', baseRef, 'HEAD'], { cwd: worktreePath });
  let added = 0;
  let deleted = 0;
  for (const line of numstat.stdout.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const a = parts[0] === '-' ? 0 : Number(parts[0]);
    const d = parts[1] === '-' ? 0 : Number(parts[1]);
    if (!Number.isNaN(a)) added += a;
    if (!Number.isNaN(d)) deleted += d;
  }

  return {
    files,
    fileCount: files.length,
    diffLines: added + deleted,
    added,
    deleted,
  };
}

function enforceDiffLimits(diff) {
  const errors = [];
  if (diff.fileCount > LIMITS.maxChangedFiles) {
    errors.push(`changed files ${diff.fileCount} > max ${LIMITS.maxChangedFiles}`);
  }
  if (diff.diffLines > LIMITS.maxDiffLines) {
    errors.push(`diff lines ${diff.diffLines} > max ${LIMITS.maxDiffLines}`);
  }
  return { ok: errors.length === 0, errors };
}

function removeWorktreeAndBranch(worktreePath, branch) {
  if (worktreePath && existsSync(worktreePath)) {
    const rm = git(['worktree', 'remove', '--force', worktreePath]);
    if (rm.code !== 0) {
      try {
        rmSync(worktreePath, { recursive: true, force: true });
        git(['worktree', 'prune']);
      } catch (e) {
        console.warn(`[agent] worktree cleanup warning: ${e.message}`);
      }
    }
  }
  if (branch) {
    git(['branch', '-D', branch]);
  }
}

function cycleTimedOut(startedAt) {
  const elapsedMs = Date.now() - startedAt;
  return elapsedMs > LIMITS.maxCycleMinutes * 60 * 1000;
}

function remainingTimeoutMs(startedAt) {
  const budget = LIMITS.maxCycleMinutes * 60 * 1000;
  return Math.max(30_000, budget - (Date.now() - startedAt));
}

/* ─── Commands ──────────────────────────────────────────────── */

function cmdDryRun() {
  ensureDirs();
  assertNotKilled();
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
  assertNotKilled();
  const runId = `once-${Date.now()}`;
  writeStatus({ state: 'run-once', runId });
  audit('run_once_start', { runId });

  console.log(`[agent] run-once ${runId}`);
  console.log('[agent] verify-only: baseline tests/build — no patches.');

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
        ? 'Tests and build green. Use `implement` for worktree-isolated safe patches.'
        : 'Baseline red — agent refuses patches until fixed.',
    nextSafeActions: [
      'node agent/cli.mjs implement --task agent/tasks/demo-docs.json',
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

function parseImplementArgs(argv) {
  let taskPath = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--task' && argv[i + 1]) {
      taskPath = argv[i + 1];
      i++;
    }
  }
  return { taskPath };
}

function cmdImplement(argv = []) {
  ensureDirs();
  assertNotKilled();

  const { taskPath } = parseImplementArgs(argv);
  const runId = `impl-${Date.now()}`;
  const startedAt = Date.now();
  let worktreePath = null;
  let branch = null;
  let reportPath = null;

  acquireLock(runId);

  const finish = (exitCode) => {
    releaseLock();
    process.exit(exitCode);
  };

  try {
    writeStatus({ state: 'implement', runId });
    audit('implement_start', { runId, taskPath });

    console.log(`[agent] implement ${runId}`);
    console.log('[agent] watchdog checks...');
    const watchdog = watchdogChecks();
    if (!watchdog.ok) {
      const report = {
        runId,
        mode: 'implement',
        decision: 'REJECT',
        reason: 'watchdog failed',
        watchdog,
        limits: LIMITS,
        safety: { merged: false, deployed: false, pushed: false },
      };
      reportPath = writeReport(runId, report);
      writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'implement', decision: 'REJECT' });
      console.error(`[agent] REJECT — watchdog: ${watchdog.failures.join('; ')}`);
      console.error(`[agent] report: ${reportPath}`);
      finish(1);
    }

    // 1. Plan
    console.log('[agent] plan...');
    const task = taskPath ? loadTaskFile(taskPath) : defaultDemoTask();
    console.log(`[agent] task: ${task.id} — ${task.title}`);

    if (cycleTimedOut(startedAt)) {
      throw new Error(`cycle timeout before patch (${LIMITS.maxCycleMinutes} min)`);
    }

    // 2. Validate policy
    console.log('[agent] validate task policy...');
    const policy = validateTaskPolicy(task);
    if (!policy.ok) {
      const report = {
        runId,
        mode: 'implement',
        task,
        decision: 'REJECT',
        reason: 'task policy validation failed',
        policyErrors: policy.errors,
        watchdog,
        limits: LIMITS,
        safety: { merged: false, deployed: false, pushed: false },
      };
      reportPath = writeReport(runId, report);
      writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'implement', decision: 'REJECT' });
      console.error(`[agent] REJECT — policy: ${policy.errors.join('; ')}`);
      console.error(`[agent] report: ${reportPath}`);
      finish(1);
    }

    // 3. Worktree
    console.log('[agent] create git worktree...');
    ({ worktreePath, branch } = createWorktree(runId, task.slug || slugify(task.id)));
    console.log(`[agent] worktree: ${worktreePath}`);
    console.log(`[agent] branch: ${branch}`);

    // 4. Bounded patch
    console.log('[agent] apply bounded patch...');
    const changedFiles = applyBoundedPatch(worktreePath, task, runId);
    const diff = measureDiff(worktreePath);
    const limitCheck = enforceDiffLimits(diff);
    if (!limitCheck.ok) {
      removeWorktreeAndBranch(worktreePath, branch);
      worktreePath = null;
      branch = null;
      const report = {
        runId,
        mode: 'implement',
        task,
        decision: 'REJECT',
        reason: 'diff limits exceeded',
        limitErrors: limitCheck.errors,
        diff,
        changedFiles,
        watchdog,
        limits: LIMITS,
        safety: { merged: false, deployed: false, pushed: false },
      };
      reportPath = writeReport(runId, report);
      writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'implement', decision: 'REJECT' });
      console.error(`[agent] REJECT — limits: ${limitCheck.errors.join('; ')}`);
      console.error(`[agent] report: ${reportPath}`);
      finish(1);
    }

    if (isKilled() || cycleTimedOut(startedAt)) {
      removeWorktreeAndBranch(worktreePath, branch);
      worktreePath = null;
      branch = null;
      const why = isKilled() ? 'kill switch' : 'cycle timeout';
      const report = {
        runId,
        mode: 'implement',
        task,
        decision: 'REJECT',
        reason: why,
        diff,
        watchdog,
        limits: LIMITS,
        safety: { merged: false, deployed: false, pushed: false },
      };
      reportPath = writeReport(runId, report);
      writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'implement', decision: 'REJECT' });
      console.error(`[agent] REJECT — ${why}`);
      finish(1);
    }

    // 5. Tests + build in worktree
    console.log('[agent] npm test && npm run build (worktree)...');
    const timeout = remainingTimeoutMs(startedAt);
    const tests = run('npm', ['test'], { cwd: worktreePath, timeout });
    const buildTimeout = remainingTimeoutMs(startedAt);
    const build = run('npm', ['run', 'build'], { cwd: worktreePath, timeout: buildTimeout });
    const verification = {
      testsPassed: tests.code === 0,
      buildPassed: build.code === 0,
      testOutputTail: (tests.stdout || tests.stderr).split('\n').slice(-20).join('\n'),
      buildOutputTail: (build.stdout || build.stderr).split('\n').slice(-20).join('\n'),
    };

    // 6. Score + decide
    const score = scoreCategories(
      verification,
      'implementer worktree candidate (deterministic, no LLM)',
    );
    const gatesOk =
      verification.testsPassed &&
      verification.buildPassed &&
      limitCheck.ok &&
      !isKilled() &&
      !cycleTimedOut(startedAt);

    const decision = gatesOk ? 'ACCEPT_CANDIDATE' : 'REJECT';
    let reason;
    if (decision === 'ACCEPT_CANDIDATE') {
      reason =
        'Tests and build passed in isolated worktree within limits. Candidate kept for manual review — NOT merged, NOT deployed, NOT pushed.';
    } else if (!verification.testsPassed || !verification.buildPassed) {
      reason = 'tests or build failed in worktree';
    } else if (isKilled()) {
      reason = 'kill switch during cycle';
    } else if (cycleTimedOut(startedAt)) {
      reason = 'cycle timeout';
    } else {
      reason = 'gates failed';
    }

    if (decision === 'REJECT') {
      console.log('[agent] REJECT — removing worktree and branch...');
      removeWorktreeAndBranch(worktreePath, branch);
      const removedBranch = branch;
      const removedWt = worktreePath;
      worktreePath = null;
      branch = null;

      const report = {
        runId,
        mode: 'implement',
        task,
        policy,
        diff,
        changedFiles,
        verification,
        score,
        decision,
        reason,
        watchdog,
        limits: LIMITS,
        cleanup: { worktreeRemoved: removedWt, branchDeleted: removedBranch },
        safety: {
          merged: false,
          deployed: false,
          pushed: false,
          wouldTouchProduction: false,
        },
        elapsedMs: Date.now() - startedAt,
      };
      reportPath = writeReport(runId, report);
      writeStatus({
        state: 'idle',
        lastRunId: runId,
        lastMode: 'implement',
        decision,
      });
      audit('implement_complete', { runId, decision, reportPath });
      console.error(`[agent] decision: ${decision}`);
      console.error(`[agent] reason: ${reason}`);
      console.error(`[agent] report: ${reportPath}`);
      finish(1);
    }

    // ACCEPT — keep worktree
    const manualReview = {
      instructions: [
        `Inspect worktree: ${worktreePath}`,
        `Inspect branch: ${branch}`,
        `Review report: agent/reports/${runId}.json`,
        'Diff: git -C <worktree> show HEAD',
        'If good: cherry-pick or merge the agent/* branch yourself into your feature branch.',
        'NEVER auto-merge to main. NEVER deploy. NEVER push from the agent.',
        'To discard: git worktree remove --force <worktree> && git branch -D <branch>',
      ],
      worktreePath,
      branch,
      relativeWorktree: relative(ROOT, worktreePath),
    };

    const report = {
      runId,
      mode: 'implement',
      task,
      policy,
      diff,
      changedFiles,
      verification,
      score,
      decision,
      reason,
      watchdog,
      limits: LIMITS,
      worktreePath,
      branch,
      manualReview,
      safety: {
        merged: false,
        deployed: false,
        pushed: false,
        wouldTouchProduction: false,
        wouldMergeMain: false,
      },
      elapsedMs: Date.now() - startedAt,
    };
    reportPath = writeReport(runId, report);
    writeStatus({
      state: 'idle',
      lastRunId: runId,
      lastMode: 'implement',
      decision,
      worktreePath,
      branch,
      reportPath,
    });
    audit('implement_complete', { runId, decision, reportPath, branch });

    console.log(`[agent] decision: ${decision}`);
    console.log(`[agent] score: ${score.total}/100`);
    console.log(`[agent] worktree: ${worktreePath}`);
    console.log(`[agent] branch: ${branch}`);
    console.log(`[agent] report: ${reportPath}`);
    console.log('[agent] manual review required — agent will NOT merge/deploy/push');
    for (const line of manualReview.instructions) {
      console.log(`  → ${line}`);
    }
    finish(0);
  } catch (err) {
    const message = err?.message || String(err);
    console.error(`[agent] implement error: ${message}`);
    if (worktreePath || branch) {
      try {
        removeWorktreeAndBranch(worktreePath, branch);
      } catch (cleanupErr) {
        console.warn(`[agent] cleanup failed: ${cleanupErr.message}`);
      }
    }
    const report = {
      runId,
      mode: 'implement',
      decision: 'REJECT',
      reason: message,
      limits: LIMITS,
      safety: { merged: false, deployed: false, pushed: false },
      elapsedMs: Date.now() - startedAt,
    };
    try {
      reportPath = writeReport(runId, report);
      console.error(`[agent] report: ${reportPath}`);
    } catch {
      /* ignore */
    }
    writeStatus({ state: 'idle', lastRunId: runId, lastMode: 'implement', decision: 'REJECT' });
    audit('implement_error', { runId, message });
    finish(1);
  }
}

function cmdStart() {
  ensureDirs();
  if (process.env.AUTONOMOUS_AGENT_ENABLED !== 'true') {
    console.error(
      '[agent] start refused: set AUTONOMOUS_AGENT_ENABLED=true to enable (default off).',
    );
    console.error('[agent] safer entrypoints: dry-run | run-once | implement');
    process.exit(1);
  }
  assertNotKilled();
  audit('start_requested', { pid: process.pid });
  console.log('[agent] start enabled via AUTONOMOUS_AGENT_ENABLED=true');
  console.log('[agent] running one implement cycle (MVP; no continuous loop flood)');
  cmdImplement(process.argv.slice(3));
}

function cmdStatus() {
  ensureDirs();
  let lock = null;
  if (existsSync(LOCK_FILE)) {
    try {
      lock = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      lock.alive = pidAlive(lock.pid);
    } catch {
      lock = { unreadable: true };
    }
  }
  const watchdog = watchdogChecks();
  console.log(
    JSON.stringify(
      {
        ...readStatus(),
        killSwitch: isKilled(),
        lock,
        watchdog,
        limits: LIMITS,
        policyAllowlist: POLICY_ALLOWLIST,
      },
      null,
      2,
    ),
  );
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

function usage() {
  console.log(`Usage: node agent/cli.mjs <command> [options]

Commands:
  dry-run              Plan only (baseline + propose task)
  run-once             Verify baseline only (no patches)
  implement [--task <path>]
                       Worktree-isolated Implementer cycle (deterministic demo if no LLM)
  start                Requires AUTONOMOUS_AGENT_ENABLED=true; runs implement once
  status               Status + lock + watchdog snapshot
  stop                 Set kill switch (agent/state/KILL)
  resume               Clear kill switch
  pause                Mark status paused
  report               Print latest report JSON

Safety: NEVER merges to main, NEVER deploys, NEVER pushes.
`);
}

const cmd = process.argv[2] ?? 'status';
switch (cmd) {
  case 'dry-run':
    cmdDryRun();
    break;
  case 'run-once':
    cmdRunOnce();
    break;
  case 'implement':
    cmdImplement(process.argv.slice(3));
    break;
  case 'start':
    cmdStart();
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
  case 'help':
  case '--help':
  case '-h':
    usage();
    break;
  default:
    usage();
    process.exit(1);
}
