# Implementer MVP (worktree-isolated)

**Status:** Implemented in `agent/cli.mjs`  
**Date:** 2026-07-15  

Safe, deterministic Implementer cycle that **does not** require an external LLM.  
Patches run only inside a git worktree. The agent **never** merges to `main`, **never** deploys, and **never** pushes.

---

## Commands

| Command | Purpose |
| ------- | ------- |
| `dry-run` | Plan only (baseline + propose) |
| `run-once` | Verify baseline only (no patches) |
| `implement [--task <path>]` | Full Implementer cycle |
| `start` | Same as implement, but requires `AUTONOMOUS_AGENT_ENABLED=true` |
| `status` / `stop` / `resume` / `pause` / `report` | Control plane |

```bash
# Recommended successful demo cycle
node agent/cli.mjs implement --task agent/tasks/demo-docs.json

# Or via helper script
bash scripts/agent-implement.sh --task agent/tasks/demo-docs.json

# Gated continuous entry (still one cycle in MVP)
AUTONOMOUS_AGENT_ENABLED=true node agent/cli.mjs start --task agent/tasks/demo-docs.json
```

---

## Implementer cycle

1. **Watchdog** — kill switch, single lock, disk, load, memory  
2. **Plan** — load task JSON (default: `agent/tasks/demo-docs.json`)  
3. **Validate policy** — allowlist only: `docs`, `tests`, `data-testid`, `a11y`, `small-ui`, `logging-scripts`  
4. **Create worktree** — `.agent/worktrees/<run-id>` on branch `agent/<run-id>/<task-slug>`  
5. **Apply bounded patch** — e.g. create `docs/AGENT_CYCLE_DEMO.md`  
6. **Enforce limits** — ≤12 files, ≤800 diff lines, ≤25 min cycle  
7. **Verify** — `npm test && npm run build` inside the worktree  
8. **Score + decide** — `ACCEPT_CANDIDATE` or `REJECT`  
9. **Report** — `agent/reports/<run-id>.json` (+ `latest.json`)

### On REJECT

- Remove worktree  
- Delete local agent branch  
- Keep the JSON report  

### On ACCEPT_CANDIDATE

- Keep worktree + branch  
- Print manual review instructions  
- Human must cherry-pick / merge into a feature branch if desired  

---

## Watchdog

| Check | Fail condition |
| ----- | -------------- |
| Lock | `agent/state/agent.lock` held by a live PID (second agent refused) |
| Kill switch | `agent/state/KILL` present |
| Disk | `df /` usage **> 85%** |
| Load | loadavg 1m **> nproc** |
| Memory | MemAvailable **< 1 GiB** |

```bash
node agent/cli.mjs stop     # write KILL
node agent/cli.mjs resume   # clear KILL
node agent/cli.mjs status   # lock + watchdog snapshot
```

---

## Example task

`agent/tasks/demo-docs.json` — docs-only safe demo:

- Policy: `docs`  
- Patch: create `docs/AGENT_CYCLE_DEMO.md`  
- No source / physics / deploy / `.env` changes  

---

## Limits (also in `LIMITS` in `cli.mjs`)

| Limit | Value |
| ----- | ----: |
| max cycle | 25 min |
| max files | 12 |
| max diff lines | 800 |
| parallel agents | 1 |

Hard forbids: merge to main, production deploy, push, secret/`.env` access.

---

## Manual review after ACCEPT

```bash
# Inspect
cat agent/reports/latest.json
git -C .agent/worktrees/<run-id> show HEAD

# Accept into your feature branch yourself (example)
git cherry-pick <agent-commit-sha>

# Or discard
git worktree remove --force .agent/worktrees/<run-id>
git branch -D agent/<run-id>/demo-docs
```

---

## What this MVP does **not** do

- Call external LLMs  
- Modify production nginx/docker/deploy  
- Touch `.env`  
- Auto-merge or auto-deploy  
- Change demo physics (prefer docs-only demo task)  
