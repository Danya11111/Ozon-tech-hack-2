# Deployment — Stage 2D

## Local

- Preview: `http://127.0.0.1:3101/`
- Production container `owl-web-1` on `127.0.0.1:3100` updated with Stage 2D dist (`index-Br8LRV1M.js`)
- Rollback: previous image `owl-web:20260730-121615` not deleted

## Public

- `sorter.arhipovdan.ru` A→185.160.137.162 openresty 404 / TLS unrecognized_name
- Cloudflare Named Tunnel: no origin cert in environment → cannot bind hostname
- Status: **BLOCKED_BY_DEPLOYMENT_ACCESS**

## Required DNS (owner)

```
Type: CNAME
Name: sorter
Target: <tunnel-id>.cfargotunnel.com
Proxy: enabled
```
