# Mobile / phone test

## Local diagnostics

- Route: `/device-test`
- Shows UA, WebGL renderer, DPR, mobile tier, Telegram WebView flag
- Screenshot: `screenshots/09-mobile-device-test.png`

## Real devices

**NOT_TESTED_ON_REAL_PHONE**

No physical Android/iPhone session in this Stage 2D run.

## Public HTTPS for phone

Blocked: `sorter.arhipovdan.ru` → A `185.160.137.162` openresty without vhost/TLS SNI.
Named Tunnel credentials unavailable (`cloudflared tunnel list` needs origin cert).

Owner DNS action for Named Tunnel (when credentials exist):

```
Type: CNAME
Name: sorter
Target: <tunnel-id>.cfargotunnel.com
Proxy: enabled
```
