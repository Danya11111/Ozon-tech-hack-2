# PUBLIC_DOMAIN_DIAGNOSTIC

Дата: 2026-07-15
Окружение: coder container `coder-arhipov-owlprime` на хосте OwlPrime

## Verdict

```text
BLOCKED_EXTERNAL
```

Постоянный домен `https://arhipovdan.ru/` **не обслуживается** текущим production-контейнером `owl-web-1`. Приложение на `127.0.0.1:3100` здорово и отдаёт актуальный bundle; проблема на уровне DNS → чужой openresty на публичном IP.

## DNS

| Поле | Значение |
| ---- | -------- |
| Nameservers | `ns1.reg.ru.`, `ns2.reg.ru.` (REG.RU, **не** Cloudflare) |
| A | `185.160.137.162` (TTL ~86400 у registrar) |
| AAAA | **нет** |
| CNAME | нет на apex; `www` тоже → `185.160.137.162` |
| Cloudflare Proxy | **нет** (NS не Cloudflare) |

Команды:

```bash
dig A arhipovdan.ru +short    # 185.160.137.162
dig AAAA arhipovdan.ru +short # (empty)
dig NS arhipovdan.ru +short   # ns1.reg.ru. ns2.reg.ru.
```

## Сетевая топология (факт)

| Проверка | Результат |
| -------- | --------- |
| Egress IP хоста (ipify) | `185.160.137.162` (совпадает с A) |
| `127.0.0.1:80` / `:443` на хосте | **closed** |
| `185.160.137.162:80` / `:443` | **open**, отвечает **openresty** |
| `127.0.0.1:3100` | **open**, `owl-web-1` nginx → `index-ncgt6PBL.js` |

Вывод: порт-форвард / другой хост за тем же публичным IP принимает 80/443. Это **не** namespace текущего Docker host listener set (на host net видны лишь `:3100` и `:8082`).

## TLS / HTTP к домену

| Проверка | Результат |
| -------- | --------- |
| `curl -4 http://arhipovdan.ru/` | **404** `Server: openresty` |
| `curl -4 https://arhipovdan.ru/` | **TLS fail**: `tlsv1 unrecognized name` (нет сертификата/vhost SNI для имени) |
| `curl -6` | нет AAAA → resolve fail |
| Certificate / SAN | получить нельзя (handshake abort) |
| HTML / bundle | недоступны через постоянный домен |

## Cloudflare Tunnel

| Поле | Значение |
| ---- | -------- |
| Type | **Quick Tunnel** only |
| Process | `/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:3100` (pid в coder) |
| Named Tunnel | **не найден** (нет systemd unit, нет config.yml credentials) |
| Permanent ingress for arhipovdan.ru | **отсутствует** |
| Working public URL | `https://invitations-based-characters-accent.trycloudflare.com/` → bundle `index-ncgt6PBL.js` |

Quick Tunnel **не** является завершённым production DNS-решением.

## Точная причина 404 / TLS fail

1. DNS A указывает на `185.160.137.162`.
2. На этом IP:80 отвечает **чужой openresty** без vhost `arhipovdan.ru` → HTTP 404.
3. На IP:443 нет SNI-сертификата для `arhipovdan.ru` → `unrecognized_name`.
4. Актуальный sorter (`owl-web-1`) слушает только `127.0.0.1:3100` и **не** связан с этим openresty.

## Что было исправлено в коде/инфре приложения

- Production container уже отдаёт `index-ncgt6PBL.js` на `:3100`.
- Добавлены диагностика, production smoke script, документация (этот файл).
- DNS/openresty **не** изменялись из этого окружения (нет доступа к REG.RU и к openresty vhost).

## Действия пользователя (точные)

### Вариант 1 — предпочтительно: Cloudflare Named Tunnel + смена NS/DNS

1. Открыть Cloudflare → Add site `arhipovdan.ru` **или** создать Named Tunnel в существующем CF-аккаунте.
2. В REG.RU → DNS управления доменом: либо делегировать NS на Cloudflare, либо оставить REG.RU и создать запись, которую выдаст `cloudflared tunnel route dns`.
3. Ingress tunnel:
   - hostname: `arhipovdan.ru` (+ `www`)
   - service: `http://127.0.0.1:3100` (если cloudflared на том же host net, что и publish `3100`)
4. Выключить/не использовать Quick Tunnel как постоянный URL.
5. Проверить:

```bash
dig A arhipovdan.ru +short
curl -I https://arhipovdan.ru/
curl -s https://arhipovdan.ru/ | grep -Eo 'index-[A-Za-z0-9_-]+\.js'
# ожидается: index-ncgt6PBL.js
```

### Вариант 2 — починить openresty на том, кто слушает 185.160.137.162:80/443

1. На сервере с openresty добавить `server_name arhipovdan.ru www.arhipovdan.ru`.
2. `proxy_pass http://<IP_этого_хоста_в_LAN>:3100;` (нужен LAN-доступ к OwlPrime:3100; сейчас publish только `127.0.0.1:3100` — потребуется сменить publish на `0.0.0.0:3100` или LAN IP **осознанно**).
3. Выпустить TLS (certbot/acme) для SNI `arhipovdan.ru`.
4. Проверить теми же curl-командами.

### Вариант 3 — сменить A-запись в REG.RU

```text
Тип: A
Имя: @ (и www)
Старое значение: 185.160.137.162
Новое значение: <IP, где реально слушает ваш reverse proxy / CF>
Proxy status: DNS only (если не Cloudflare) или Proxied (если Cloudflare)
```

## Проверочные команды после фикса

```bash
curl -I https://arhipovdan.ru/
curl -I https://arhipovdan.ru/details
curl -I https://arhipovdan.ru/assets/index-ncgt6PBL.js
curl -s https://arhipovdan.ru/ | grep -Eo 'index-[A-Za-z0-9_-]+\.js'
PLAYWRIGHT_BASE_URL=https://arhipovdan.ru/ npm run test:e2e:production
```
