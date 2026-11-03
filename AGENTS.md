# Resto – web Hostince na Faře (React + Vite SPA, API na Cloudflare Workers, bez databáze)

Postaveno podle https://developers.cloudflare.com/workers/framework-guides/web-apps/react/ (Cloudflare Vite plugin).

- Node 22 (`nvm use` – viz `.nvmrc`; wrangler vyžaduje Node >= 22).
- Samostatný projekt; balíčky z veřejného registry `https://registry.npmjs.org`, verze pinovat (starší než 7 dní).
- Repozitář: https://github.com/QCX4-IR2lMd41w/resto (`origin` = `git@github.com:QCX4-IR2lMd41w/resto.git`, větev `main`).
- Commity jen pod identitou `QCX4-IR2lMd41w <QCX4-IR2lMd41w@wo.cz>` – nastavit pro každý commit (`git -c user.name=… -c user.email=… commit`), globální git config (pracovní e-mail) nepoužívat.
- Vývoj: `npm run dev` (Vite + Workers runtime, http://localhost:5173). Data lokálně v `.wrangler/state`.
- Kontrola: `npm run typecheck` (wrangler types + tsc -b), `npm run build`, `npm run preview` (produkční build lokálně, vč. `_headers`/CSP).
- Naplnění menu: `npm run seed:local` / `npm run seed:remote` (z `seed/menus.json`, klíč `menus` – přepíše všechna uložená menu!).
- Správci (max 5, PBKDF2-SHA256 100k): `npm run users add|passwd|remove <jmeno>`, `npm run users list`.
  Ukládá do `users.json` + `.dev.vars` (obojí mimo git). Na Cloudflare: `npm run users push` (secret `USERS`).
- Secrets na Cloudflare: `USERS` (JSON jméno → hash), `SESSION_SECRET` (min. 32 znaků).

## Struktura
- `src/` – React SPA (vlastní mini router `src/router.tsx`, stránky v `src/pages/`, admin v `src/pages/admin/`, styly `src/index.css`).
- `worker/` – Hono API pod `/api/*` (`index.ts` routy, `auth.ts` přihlášení/session/throttling, `storage.ts` KV + obrázky).
- `shared/` – sdílené typy a konstanty (`menu.ts`) a údaje o podniku (`site.ts`).
- `public/` – statické soubory (fotky webu v `images/`, `_headers` s CSP).
- `wrangler.jsonc` – `assets.not_found_handling: single-page-application`, `run_worker_first: ["/api/*"]`, KV binding `MENU_KV`.

## Menu (datový model)
- `MenuStore` = `{ activeId, menus[] }`; na webu se zobrazuje jen aktivní menu (`GET /api/menu`), ostatní vidí jen správce.
- `Menu` = `{ id, name, note, sections[] }`; `Section` = `{ id, title, weekday, items[] }` – sekce je cokoliv s názvem.
- `weekday` (po…ne) označuje sekci jako den v týdnu: úvodní stránka z ní ukazuje „Dnešní menu“. V adminu se den odhadne z názvu (`detectWeekday`: „Pondělí 3. 11.“ → po), jde nastavit i ručně.
- Šablony nového menu: týdenní (Po–Pá + Stálá nabídka), prázdné, kopie existujícího (fotky se duplikují).
- Starý formát (klíč `menu`) se při prvním čtení převede do `menus` (`fromLegacy` ve `worker/storage.ts`).

## Bezpečnost
- Session = podepsaný HttpOnly cookie (HMAC, SameSite=Strict, 8 h), svázaný s hashem hesla (změna hesla = odhlášení).
- CSRF: mutace vyžadují hlavičku `X-Requested-With: resto` + kontrola Origin.
- Blokace přihlášení: 5 chyb / 15 min na IP (KV `fail:<hash IP>`).
- Fotky: zmenšení v prohlížeči (`src/resizeImage.ts`), server kontroluje magic bytes, servíruje s `sandbox` CSP.
- KV klíče: `menus` (všechna menu), `img:<hex>` (fotky), `fail:*`; `menu` = starý formát, jen pro migraci.

## Nasazení
1. `npx wrangler login`
2. `npx wrangler kv namespace create MENU_KV` → id vložit do `wrangler.jsonc`
3. `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET`
4. `npm run users add <jmeno>` a `npm run users push`
5. `npm run deploy` a `npm run seed:remote`
- Alternativně Workers Builds (dashboard → Workers → Import repository): build `npm run build`, deploy `npx wrangler deploy`.
