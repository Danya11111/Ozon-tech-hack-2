# FINAL_DEMO_READINESS

Дата: 2026-07-15
Ветка: `feature/maximum-demo-realism`
Production release (не тронут этим коммитом): `20260715-1712` / `index-ncgt6PBL.js`

## Status board

| Область | Статус | Комментарий |
| ------- | ------ | ----------- |
| Git | PASS | Feature branch clean after commit; no push |
| Production container | PASS | `owl-web-1` на `:3100`, bundle `index-ncgt6PBL.js` |
| Permanent domain | BLOCKED_EXTERNAL | `arhipovdan.ru` → openresty 404 / TLS SNI fail |
| TLS | BLOCKED_EXTERNAL | Нет SNI-сертификата на destination IP |
| Main route | PASS | Local + Quick Tunnel |
| Details route | PASS | SPA fallback 200 |
| Unit tests | PASS | 166 |
| E2E | PASS | 15 (excl. production) |
| Visual regression | PASS | 10 snapshots |
| GPU performance | PARTIAL | SwiftShader/xvfb only; hardware baseline blocked in coder |
| Safety scenarios | PASS | Jam + E-stop e2e |
| Rollback | PASS | Tag `backup/pre-maximum-demo-realism-20260715` + docker rename |
| Agent safety | PASS | Worktree / dry-run / no auto DNS |

## Verdict

```text
READY WITH EXTERNAL DOMAIN BLOCKER
```

Live demo **можно** вести с:

- `http://127.0.0.1:3100/` (локально), или
- актуального Quick Tunnel `https://invitations-based-characters-accent.trycloudflare.com/`

Постоянный домен `https://arhipovdan.ru/` **не готов** до DNS/proxy фикса пользователем (см. `PUBLIC_DOMAIN_DIAGNOSTIC.md`).

## Next deploy note

Новый код (perf overlay, twin layout, visual snapshots) собран как `index-DEbogfOZ.js` в `dist/`, но **не** задеплоен в `owl-web-1`, чтобы не нарушить работающий production. Redeploy — отдельный шаг после доменного фикса или явного запроса.
