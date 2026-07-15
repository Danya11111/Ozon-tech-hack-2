# PRODUCTION_DEPLOYMENT_REPORT

Дата: 2026-07-15
Ветка: `feature/maximum-demo-realism`
Базовый commit этапа 1: `985f7c3`
Production bundle после этапа 2: `index-ncgt6PBL.js`

## Способ деплоя

Docker-контейнер `owl-web-1` (image `owl-web:<release>`), порт `127.0.0.1:3100→80`.
Docker API: `DOCKER_HOST=tcp://127.0.0.1:2375` (из coder-контейнера).
Compose-файл: `docker-compose.server.yml` (исторически `-p owl`).
Скрипт: `scripts/deploy-production.sh`.

Публичный доступ в этой среде:

- Loopback: `http://127.0.0.1:3100/`
- Quick tunnel cloudflared: `https://invitations-based-characters-accent.trycloudflare.com/`
- `https://arhipovdan.ru/` из контейнера даёт TLS SNI / openresty 404 — DNS/прокси домена вне текущего coder-окружения; проверяйте снаружи.

## Releases

| Поле | Значение |
| ---- | -------- |
| Old release container | `owl-web-1-backup-20260715-165347` / `…-1712` |
| Old bundle | `index-CCdZzxPJ.js` |
| New release | `20260715-1712` |
| New image | `owl-web:20260715-1712` |
| New bundle | `index-ncgt6PBL.js` |
| Backup HTML | `releases/backup-pre-*` |

## Команды

```bash
export DOCKER_HOST=tcp://127.0.0.1:2375
cd /home/coder/arhipovdan/app
npm test && npm run build
bash scripts/deploy-production.sh 20260715-1712
curl -s http://127.0.0.1:3100/ | grep -Eo 'index-[A-Za-z0-9_-]+\.js'
```

## Healthcheck

| Check | Result |
| ----- | ------ |
| `GET /` | 200 |
| `GET /details` (SPA) | 200 |
| Bundle | `index-ncgt6PBL.js` |
| Tunnel HTML | same bundle |
| `https://arhipovdan.ru/` | **BLOCKED_EXTERNAL** — `PUBLIC_DOMAIN_DIAGNOSTIC.md` |

## Public smoke

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e:production
PLAYWRIGHT_BASE_URL=https://invitations-based-characters-accent.trycloudflare.com/ npm run test:e2e:production
```

## Rollback

```bash
export DOCKER_HOST=tcp://127.0.0.1:2375
docker stop owl-web-1 && docker rm owl-web-1
docker rename owl-web-1-backup-20260715-1712 owl-web-1
docker start owl-web-1
```

Или восстановить HTML из `releases/backup-pre-<release>/`.

## Smoke (tunnel)

Подтверждено: CASE 1/10, Jump to case 1–10, Previous/Next, Present, Play Demo, `/details`.
