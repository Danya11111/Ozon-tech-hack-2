# CLOUDFLARE_NAMED_TUNNEL_SETUP

## Goal

Постоянный HTTPS для `arhipovdan.ru` / `www.arhipovdan.ru` → production `http://127.0.0.1:3100` (`owl-web-1`), без открытия 80/443 на OwlPrime.

Quick Tunnel (`*.trycloudflare.com`) **сохранять** до полного PASS постоянного домена.

## Architecture choice

```text
REG.RU = registrar only
Cloudflare = authoritative DNS + Named Tunnel + managed TLS
```

## Current blocker in this environment

```text
cloudflared tunnel list → no origin cert (cert.pem)
CLOUDFLARE_API_TOKEN → unset
```

Named Tunnel **нельзя** создать/привязать DNS из coder без `cloudflared login` или API token.

## Recommended tunnel name

```text
owlprime-sorter-production
```

## Config template (do not commit credentials)

Path suggestion (host, outside git):

```text
~/.cloudflared/config.yml
~/.cloudflared/<TUNNEL_UUID>.json   # credentials — chmod 600
```

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: arhipovdan.ru
    service: http://127.0.0.1:3100
  - hostname: www.arhipovdan.ru
    service: http://127.0.0.1:3100
  - service: http_status:404
```

Service target assumes cloudflared on **host network namespace** with publish `127.0.0.1:3100` (current). If cloudflared runs in Docker, use `http://host.docker.internal:3100` or shared network alias `http://owl-web-1:80` — never a ephemeral container IP.

## Operator steps (when Cloudflare access available)

1. `cloudflared login` (or set API token with Tunnel + Zone DNS edit).
2. `cloudflared tunnel list` — reuse existing sorter tunnel if present.
3. Else: `cloudflared tunnel create owlprime-sorter-production`
4. Write config (template above). Validate: `cloudflared tunnel ingress validate`
5. Run connector (systemd preferred): `cloudflared tunnel run owlprime-sorter-production`
6. Add domain to Cloudflare → note **exact** assigned nameservers.
7. Import **all** DNS from `DNS_MIGRATION_INVENTORY.md` / REG.RU panel.
8. Create public hostnames / `cloudflared tunnel route dns <tunnel> arhipovdan.ru` (+ www).
9. Remove conflicting A `185.160.137.162` for apex/www in Cloudflare zone.
10. Only then change NS at REG.RU.
11. Keep Quick Tunnel until:

```bash
curl -s https://arhipovdan.ru/version.json
# expected commit from production
PLAYWRIGHT_BASE_URL=https://arhipovdan.ru EXPECTED_COMMIT=<sha> npm run test:e2e:production
```

## Coexistence with Quick Tunnel

| Process | Role |
| ------- | ---- |
| `cloudflared tunnel --url http://127.0.0.1:3100` | Temporary public URL |
| Named Tunnel connector | Permanent hostnames (after CF zone) |

They can run in parallel; different Cloudflare edge bindings.

## Secrets policy

Never commit:

* `*.json` credentials
* `cert.pem`
* API tokens
* tunnel tokens in systemd unit Environment=

## Status (2026-07-16)

```text
Named Tunnel created: NO (auth missing — no cert.pem / CLOUDFLARE_API_TOKEN)
Ingress prepared as docs: YES
Connector healthy: N/A
DNS route: N/A
NS cutover: WAITING_USER — Cloudflare nameservers not assigned yet
Quick Tunnel: KEEP RUNNING until permanent HTTPS PASS
```
