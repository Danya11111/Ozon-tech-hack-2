# Deployment Report — Stage 2B

## Verdict

**BLOCKED_BY_DEPLOYMENT_ACCESS** for permanent hostname `sorter.arhipovdan.ru`.

Local production container and Cloudflare Quick Tunnel **are live**.

## What is running

| Layer | Value |
|---|---|
| Production container | `owl-web-1` on `127.0.0.1:3100` |
| Image | `owl-web:20260730-110405` (rebuild with Stage 2B assets) |
| Rollback container | `owl-web-1-backup-20260730-100522` (and earlier backups) |
| Nginx (in-container) | SPA fallback, gzip, security headers, GLB MIME `model/gltf-binary`, no-store for `/version.json` |
| Preview (dev) | `127.0.0.1:3101` vite preview |
| Quick Tunnel | `cloudflared tunnel --url http://127.0.0.1:3100` → ephemeral `*.trycloudflare.com` |

## Public domain audit

| Check | Result |
|---|---|
| DNS `sorter.arhipovdan.ru` A | `185.160.137.162` |
| DNS `arhipovdan.ru` A | `185.160.137.162` |
| Nameservers | `ns1.reg.ru` / `ns2.reg.ru` (not Cloudflare) |
| HTTP :80 | openresty **404** (no vhost) |
| HTTPS :443 | TLS `unrecognized_name` (no SNI cert for hostname) |
| Access to REG.RU / openresty host | **none from this environment** |

## Required DNS / edge records (for operator)

```text
# Preferred: Cloudflare Named Tunnel + NS cutover
Type: CNAME or Tunnel route
Name: sorter
Target: <cloudflare tunnel id>.cfargotunnel.com
Proxy: Proxied

# Or fix openresty on 185.160.137.162:
server_name sorter.arhipovdan.ru;
ssl_certificate ...;
proxy_pass http://<owlprime-lan>:3100;
```

## Rollback

```bash
# Via Docker API (no local docker CLI in this container):
curl -X POST http://127.0.0.1:2375/containers/owl-web-1/stop
curl -X POST 'http://127.0.0.1:2375/containers/owl-web-1/rename?name=owl-web-1-failed'
curl -X POST 'http://127.0.0.1:2375/containers/owl-web-1-backup-20260730-100522/rename?name=owl-web-1'
curl -X POST http://127.0.0.1:2375/containers/owl-web-1/start
```

## Secrets

No Cloudflare API tokens, origin certificates, or registrar credentials are present in this environment. None are printed in this report.
