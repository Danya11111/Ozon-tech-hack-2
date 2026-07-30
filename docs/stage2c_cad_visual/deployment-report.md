# Deployment — Stage 2C

## Local production

- Container `owl-web-1` on `127.0.0.1:3100` hot-updated with Stage 2C `dist/` (asset `index-CA2EvFI-.js`)
- Preview control: `127.0.0.1:3101` (`vite preview`)
- Previous container/image retained; no rollback deleted

## Public domain

- `sorter.arhipovdan.ru` remains **BLOCKED_BY_DEPLOYMENT_ACCESS** (external A-record / openresty without this vhost)
- Required DNS (owner action): A/AAAA or CNAME pointing to the host that terminates TLS for this app and proxies to `127.0.0.1:3100` (or LAN equivalent)
- Cloudflare tunnel tokens are not published here

## Phone

- NOT_TESTED_ON_REAL_PHONE
