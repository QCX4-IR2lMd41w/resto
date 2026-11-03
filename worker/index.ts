import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import {
    CATEGORIES, DAYS, FIELD_LIMITS, SECTIONS, WEEK_LABEL_LIMIT, isSection,
    type Category, type Menu, type MenuItem, type TextField,
} from '../shared/menu';
import {
    checkCredentials, clearFailures, currentUser, endSession, isLockedOut, loadUsers, recordFailure, startSession,
    type AppEnv,
} from './auth';
import {
    copyImage, deleteImage, findItem, getImage, putImage, randomHex, readMenu, readUploadedImage, validImageName, writeMenu,
} from './storage';

type Ctx = Context<AppEnv>;

const app = new Hono<AppEnv>().basePath('/api');

const clip = (value: unknown, max: number) => Array.from(String(value ?? '').trim()).slice(0, max).join('');
const fail = (c: Ctx, status: 400 | 401 | 403 | 404 | 422 | 429, error: string) => c.json({ error }, status);
const done = (c: Ctx, menu: Menu, message?: string) => c.json({ menu, message });

// ---------- security ----------

app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'same-origin');
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

// CSRF: state-changing requests must come from our own origin and carry a custom header
// (a cross-site form or fetch cannot set it without a CORS preflight, which we never allow).
app.use('*', async (c, next) => {
    if (!['GET', 'HEAD'].includes(c.req.method)) {
        const origin = c.req.header('Origin');
        if ((origin && origin !== new URL(c.req.url).origin) || c.req.header('X-Requested-With') !== 'resto') {
            return fail(c, 403, 'Požadavek byl zablokován.');
        }
    }
    await next();
});

const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    const user = await currentUser(c);
    if (!user) return fail(c, 401, 'Přihlaste se prosím.');
    c.set('user', user);
    await next();
});

// ---------- public ----------

app.get('/menu', async (c) => {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(await readMenu(c.env));
});

app.get('/img/:name', async (c) => {
    const name = c.req.param('name');
    if (!validImageName(name)) return fail(c, 404, 'Obrázek nenalezen.');
    const { value, metadata } = await getImage(c.env, name);
    if (!value) return fail(c, 404, 'Obrázek nenalezen.');
    return c.body(value, 200, {
        'Content-Type': metadata?.type ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    });
});

// ---------- auth ----------

app.get('/session', async (c) => c.json({ user: await currentUser(c), hasUsers: Object.keys(loadUsers(c.env)).length > 0 }));

app.post('/login', async (c) => {
    if (await isLockedOut(c)) return fail(c, 429, 'Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.');
    const body = await c.req.json<{ username?: unknown; password?: unknown }>().catch(() => ({}) as Record<string, unknown>);
    const username = String(body.username ?? '').trim();
    const hash = await checkCredentials(c.env, username, String(body.password ?? ''));
    if (!hash) {
        await recordFailure(c);
        return fail(c, 401, 'Nesprávné jméno nebo heslo.');
    }
    await clearFailures(c);
    await startSession(c, username, hash);
    return c.json({ user: username });
});

app.post('/logout', (c) => {
    endSession(c);
    return c.json({ ok: true });
});

// ---------- admin: menu ----------

app.use('/admin/*', requireUser);

app.put('/admin/week', async (c) => {
    const body = await c.req.json<{ week_label?: unknown }>();
    const menu = await readMenu(c.env);
    menu.week_label = clip(body.week_label, WEEK_LABEL_LIMIT);
    await writeMenu(c.env, menu);
    return done(c, menu, 'Označení týdne uloženo.');
});

app.post('/admin/clear', async (c) => {
    const menu = await readMenu(c.env);
    for (const code of Object.keys(DAYS) as (keyof typeof DAYS)[]) {
        await Promise.all(menu.days[code].map((item) => deleteImage(c.env, item.image)));
        menu.days[code] = [];
    }
    await writeMenu(c.env, menu);
    return done(c, menu, 'Týdenní menu bylo smazáno (stálá nabídka zůstala).');
});

async function saveItem(c: Ctx, id: string | null) {
    const body = await c.req.parseBody();
    const data = Object.fromEntries(
        (Object.entries(FIELD_LIMITS) as [TextField, number][]).map(([f, max]) => [f, clip(body[f], max)]),
    ) as Record<TextField, string>;
    const category: Category = CATEGORIES.includes(body.category as Category) ? (body.category as Category) : 'Ostatní';
    const day = body.day;
    if (!isSection(day)) return fail(c, 422, 'Vyberte den.');
    if (!data.name) return fail(c, 422, 'Název jídla je povinný.');

    let upload = null;
    if (body.image instanceof File && body.image.size > 0) {
        try {
            upload = await readUploadedImage(body.image);
        } catch (e) {
            return fail(c, 422, (e as Error).message);
        }
    }

    const menu = await readMenu(c.env);
    const pos = id ? findItem(menu, id) : null;
    if (id && !pos) return fail(c, 404, 'Položka nenalezena.');
    const existing: MenuItem = pos
        ? menu.days[pos[0]][pos[1]]
        : { id: randomHex(16), name: '', description: '', price: '', weight: '', allergens: '', category, image: null };
    const item: MenuItem = { ...existing, ...data, category };

    if (upload || body.remove_image) {
        await deleteImage(c.env, existing.image);
        item.image = upload ? await putImage(c.env, upload) : null;
    }
    if (pos) menu.days[pos[0]].splice(pos[1], 1, ...(pos[0] === day ? [item] : []));
    if (!pos || pos[0] !== day) menu.days[day].push(item);
    await writeMenu(c.env, menu);
    return done(c, menu, id ? 'Změny uloženy.' : `Jídlo „${item.name}“ přidáno.`);
}

app.post('/admin/items', (c) => saveItem(c, null));
app.put('/admin/items/:id', (c) => saveItem(c, c.req.param('id')));

app.delete('/admin/items/:id', async (c) => {
    const menu = await readMenu(c.env);
    const pos = findItem(menu, c.req.param('id'));
    if (!pos) return fail(c, 404, 'Položka nenalezena.');
    const [item] = menu.days[pos[0]].splice(pos[1], 1);
    await deleteImage(c.env, item.image);
    await writeMenu(c.env, menu);
    return done(c, menu, `Jídlo „${item.name}“ smazáno.`);
});

app.post('/admin/items/:id/move', async (c) => {
    const { direction } = await c.req.json<{ direction?: unknown }>();
    const menu = await readMenu(c.env);
    const pos = findItem(menu, c.req.param('id'));
    if (!pos) return fail(c, 404, 'Položka nenalezena.');
    const [day, i] = pos;
    const items = menu.days[day];
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < items.length) [items[i], items[j]] = [items[j], items[i]];
    await writeMenu(c.env, menu);
    return done(c, menu);
});

app.post('/admin/items/:id/copy', async (c) => {
    const { target } = await c.req.json<{ target?: unknown }>();
    if (!isSection(target)) return fail(c, 400, 'Neplatný den.');
    const menu = await readMenu(c.env);
    const pos = findItem(menu, c.req.param('id'));
    if (!pos) return fail(c, 404, 'Položka nenalezena.');
    const source = menu.days[pos[0]][pos[1]];
    menu.days[target].push({ ...source, id: randomHex(16), image: await copyImage(c.env, source.image) });
    await writeMenu(c.env, menu);
    return done(c, menu, `Jídlo zkopírováno do: ${SECTIONS[target]}.`);
});

app.notFound((c) => fail(c, 404, 'Nenalezeno.'));
app.onError((err, c) => {
    console.error(err);
    if (err instanceof SyntaxError) return fail(c, 400, 'Neplatná data.');
    return c.json({ error: 'Omlouváme se, došlo k chybě serveru.' }, 500);
});

export default app;
