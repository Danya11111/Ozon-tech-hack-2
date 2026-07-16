# PRODUCTION_DEPLOYMENT_REPORT

Дата: 2026-07-16 (re-verified)
Ветка: `feature/maximum-demo-realism`

## Current production

| Поле | Значение |
| ---- | -------- |
| Container | `owl-web-1` |
| Image | `owl-web:20260715-2221` |
| Bundle | `index-AagIOJbd.js` |
| Version endpoint | `/version.json` |
| Deployed commit (identity) | `4fcce5b` |
| Release id | `20260715-2221` |
| Publish | `127.0.0.1:3100→80` |
| Backup container | `owl-web-1-backup-20260715-2221` |

## Previous

| Поле | Значение |
| ---- | -------- |
| Release | `20260715-2215` (interim) / `20260715-1712` |
| Bundle | `index-AagIOJbd.js` / `index-ncgt6PBL.js` |
| Commit identity | `16e7930` then superseded by `4fcce5b` |

## Public access

| URL | Status |
| --- | ------ |
| `http://127.0.0.1:3100/` | PASS — commit `4fcce5b` |
| Quick Tunnel | PASS — same commit (kept running) |
| `https://arhipovdan.ru/` | BLOCKED_EXTERNAL — openresty / TLS SNI |

## Deploy command

```bash
export DOCKER_HOST=tcp://127.0.0.1:2375
EXPECTED_COMMIT=4fcce5b bash scripts/deploy-production.sh 20260715-2221
```

Build args inject `BUILD_COMMIT` / `BUILD_BRANCH` / `BUILD_RELEASE` because `.git` is dockerignored.

## Rollback

```bash
export DOCKER_HOST=tcp://127.0.0.1:2375
docker stop owl-web-1 && docker rm owl-web-1
docker rename owl-web-1-backup-20260715-2221 owl-web-1
docker start owl-web-1
```

## Smoke

```bash
curl -s http://127.0.0.1:3100/version.json
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 EXPECTED_COMMIT=4fcce5b npm run test:e2e:production
PLAYWRIGHT_BASE_URL=https://invitations-based-characters-accent.trycloudflare.com EXPECTED_COMMIT=4fcce5b npm run test:e2e:production
```

Both local and Quick Tunnel: **PASS**.
