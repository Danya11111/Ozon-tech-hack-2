# Deployment — Stage 2E

## Local production

| Item | Value |
|------|-------|
| Container | `owl-web-1` |
| Image | `owl-web:stage2e-20260730-140024` (also tagged `owl-web:latest`) |
| Bind | `127.0.0.1:3100→80` |
| Asset | `assets/index-DW5Sc3w-.js` |
| Health | `GET /` 200, `GET /device-test` 200, `GET /details` 200 |
| Preview | `http://127.0.0.1:3101/` (vite preview; not duplicate production) |

## Rollback (one command family)

Previous Stage 2D container preserved as `owl-web-1-rollback-stage2d` (image `owl-web:20260730-121615` retained).

```bash
# Via Docker HTTP API (this host has no docker CLI in PATH):
curl -X POST http://127.0.0.1:2375/containers/owl-web-1/stop?t=5
curl -X POST http://127.0.0.1:2375/containers/owl-web-1/rename?name=owl-web-1-stage2e-failed
curl -X POST http://127.0.0.1:2375/containers/owl-web-1-rollback-stage2d/rename?name=owl-web-1
curl -X POST http://127.0.0.1:2375/containers/owl-web-1/start
```

Or with docker CLI if available:

```bash
docker stop owl-web-1 && docker rename owl-web-1 owl-web-1-stage2e-failed
docker rename owl-web-1-rollback-stage2d owl-web-1 && docker start owl-web-1
```

## Public domain

- `sorter.arhipovdan.ru` A→`185.160.137.162` openresty 404 / TLS `unrecognized_name`
- Cloudflare Named Tunnel: **not configured** (no origin cert in environment)
- Status: **BLOCKED_BY_DEPLOYMENT_ACCESS**
- Owner DNS action required (CNAME `sorter` → `<TUNNEL_ID>.cfargotunnel.com`, Proxied)

## Secrets

No credentials, tokens, or private keys recorded in this report.
