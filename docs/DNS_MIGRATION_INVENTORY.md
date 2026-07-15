# DNS_MIGRATION_INVENTORY

Дата: 2026-07-15
Домен: `arhipovdan.ru`
Источник: публичные `dig` запросы с OwlPrime/coder.

## Текущие authoritative NS

```text
ns1.reg.ru.
ns2.reg.ru.
```

REG.RU = регистратор **и** DNS provider. Cloudflare zone пока **не** создана из этого окружения (нет `cert.pem` / API token).

## Публичные записи

| Type | Name | Current value | TTL (approx) | Must migrate | Purpose |
| ---- | ---- | ------------- | -----------: | ------------ | ------- |
| NS | @ | ns1.reg.ru / ns2.reg.ru | — | Yes (delegation) | Authoritative DNS |
| SOA | @ | ns1.reg.ru. hostmaster… | 10800 | Auto in CF | Zone SOA |
| A | @ | 185.160.137.162 | 21600 | **Replace** with CF tunnel route | Broken openresty (404 / TLS SNI fail) |
| A | www | 185.160.137.162 | — | **Replace** with CF tunnel route | Same broken endpoint |
| AAAA | @ | *(none)* | — | No | — |
| CNAME | @ | *(none)* | — | No | Apex CNAME not used |
| MX | @ | *(none publicly visible)* | — | **Check in REG.RU panel** | Mail may be absent |
| TXT | @ | *(none publicly visible)* | — | **Check in REG.RU panel** | SPF / domain verify |
| TXT | `_dmarc` | *(none)* | — | **Check panel** | DMARC |
| TXT | `default._domainkey` | *(none)* | — | **Check panel** | DKIM |
| CAA | @ | *(none)* | — | Optional | TLS CA policy |

### Subdomain probe (public A)

Many common labels resolve to the **same** `185.160.137.162` (likely REG.RU catch-all / parking):

| Name | A | Notes |
| ---- | - | ----- |
| mail | 185.160.137.162 | Confirm real mail usage in panel |
| smtp | 185.160.137.162 | |
| api | 185.160.137.162 | |
| app | 185.160.137.162 | |
| staging | 185.160.137.162 | |
| blog | 185.160.137.162 | |
| ftp | 185.160.137.162 | |

**Перед сменой NS** откройте панель REG.RU → DNS и перенесите **все** реальные записи (особенно MX/TXT/DKIM), не только A для сайта.

## Что нельзя потерять

1. Любые MX / SPF / DKIM / DMARC (если почта используется).
2. TXT верификации (Google, Yandex, Cloudflare, etc.).
3. Поддомены других сервисов, если отличаются от parking IP.
4. CAA, если планируется нестандартный CA.

## Рекомендуемый target после Cloudflare zone

| Hostname | Type on Cloudflare | Target |
| -------- | ------------------ | ------ |
| `arhipovdan.ru` | Cloudflare Tunnel CNAME / route | Named Tunnel `owlprime-sorter-production` |
| `www.arhipovdan.ru` | same | same tunnel ingress |

Не создавать «A = Named Tunnel» — A принимает только IPv4.

## Сравнение вариантов публикации

| Вариант | Требования | Риск | Рекомендация |
| ------- | ---------- | ---- | ------------ |
| Cloudflare Named Tunnel + NS на CF | Cloudflare zone + миграция всех DNS | Низкий | **Предпочтительно** |
| Direct nginx на OwlPrime :80/:443 | Public IP, NAT, firewall, TLS | Средний/высокий | Не делать автоматически |
| Quick Tunnel | Нет постоянного hostname | Высокий для demo | Только temporary fallback |

## Статус миграции

```text
Inventory: DONE (public)
Cloudflare zone: NOT CREATED (needs user / API login)
NS changed: NO
```
