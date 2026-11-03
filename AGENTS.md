# Resto – web Hostince na Faře (React + Vite SPA, API na Cloudflare Workers, bez databáze)

Postaveno podle https://developers.cloudflare.com/workers/framework-guides/web-apps/react/ (Cloudflare Vite plugin).

- Node 22 (`nvm use` – viz `.nvmrc`; wrangler vyžaduje Node >= 22).
- Samostatný projekt; balíčky z veřejného registry `https://registry.npmjs.org`, verze pinovat (starší než 7 dní).
- Vývoj: `npm run dev` (Vite + Workers runtime, http://localhost:5173). Data lokálně v `.wrangler/state`.
- Kontrola: `npm run typecheck` (wrangler types + tsc -b), `npm run build`, `npm run preview` (produkční build lokálně, vč. `_headers`/CSP).
- Naplnění menu: `npm run seed:local` / `npm run seed:remote` (z `seed/menu.json`).
- Správci (max 5, PBKDF2-SHA256 100k): `npm run users add|passwd|remove <jmeno>`, `npm run users list`.
  Ukládá do `users.json` + `.dev.vars` (obojí mimo git). Na Cloudflare: `npm run users push` (secret `USERS`).
- Secrets na Cloudflare: `USERS` (JSON jméno → hash), `SESSION_SECRET` (min. 32 znaků).

## Struktura
- `src/` – React SPA (vlastní mini router `src/router.tsx`, stránky v `src/pages/`, admin v `src/pages/admin/`, styly `src/index.css`).
- `worker/` – Hono API pod `/api/*` (`index.ts` routy, `auth.ts` přihlášení/session/throttling, `storage.ts` KV + obrázky).
- `shared/` – sdílené typy a konstanty (`menu.ts`: dny, `stala` = Stálá nabídka, kategorie) a údaje o podniku (`site.ts`).
- `public/` – statické soubory (fotky webu v `images/`, `_headers` s CSP).
- `wrangler.jsonc` – `assets.not_found_handling: single-page-application`, `run_worker_first: ["/api/*"]`, KV binding `MENU_KV`.

## Bezpečnost
- Session = podepsaný HttpOnly cookie (HMAC, SameSite=Strict, 8 h), svázaný s hashem hesla (změna hesla = odhlášení).
- CSRF: mutace vyžadují hlavičku `X-Requested-With: resto` + kontrola Origin.
- Blokace přihlášení: 5 chyb / 15 min na IP (KV `fail:<hash IP>`).
- Fotky: zmenšení v prohlížeči (`src/resizeImage.ts`), server kontroluje magic bytes, servíruje s `sandbox` CSP.
- KV klíče: `menu` (JSON týdne), `img:<hex>` (fotky), `fail:*`.

## Nasazení
1. `npx wrangler login`
2. `npx wrangler kv namespace create MENU_KV` → id vložit do `wrangler.jsonc`
3. `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET`
4. `npm run users add <jmeno>` a `npm run users push`
5. `npm run deploy` a `npm run seed:remote`
- Alternativně Workers Builds (dashboard → Workers → Import repository): build `npm run build`, deploy `npx wrangler deploy`.
