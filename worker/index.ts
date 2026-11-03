import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import {
    CATEGORIES, FIELD_LIMITS, LIMITS, activeMenu,
    type Category, type Menu, type MenuItem, type MenuStore, type MenuTemplate, type TextField,
} from '../shared/menu';
import {
    checkCredentials, clearFailures, currentUser, endSession, isLockedOut, loadUsers, recordFailure, startSession,
    type AppEnv,
} from './auth';
import {
    cloneSections, copyImage, deleteImage, deleteSectionImages, findItem, findMenu, findSection, getImage, newSection,
    parseWeekday, putImage, randomHex, readStore, readUploadedImage, validImageName, weeklySections, writeStore,
} from './storage';

type Ctx = Context<AppEnv>;
type Json = Record<string, unknown>;

const app = new Hono<AppEnv>().basePath('/api');

const clip = (value: unknown, max: number) => Array.from(String(value ?? '').trim()).slice(0, max).join('');
const fail = (c: Ctx, status: 400 | 401 | 403 | 404 | 409 | 422 | 429, error: string) => c.json({ error }, status);
const json = (c: Ctx) => c.req.json<Json>().catch(() => ({}) as Json);

/** Saves the store and returns it to the admin UI together with an optional message. */
async function save(c: Ctx, store: MenuStore, message?: string) {
    await writeStore(c.env, store);
    return c.json({ store, message });
}

function move<T>(list: T[], index: number, direction: unknown) {
    const j = direction === 'up' ? index - 1 : index + 1;
    if (j >= 0 && j < list.length) [list[index], list[j]] = [list[j], list[index]];
}

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

/** The active menu only – other stored menus are never exposed publicly. */
app.get('/menu', async (c) => {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(activeMenu(await readStore(c.env)));
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
    const body = await json(c);
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

// ---------- admin: menus ----------

app.use('/admin/*', requireUser);

app.get('/admin/store', async (c) => c.json(await readStore(c.env)));

app.post('/admin/menus', async (c) => {
    const body = await json(c);
    const store = await readStore(c.env);
    if (store.menus.length >= LIMITS.menus) return fail(c, 409, `Lze uložit nejvýše ${LIMITS.menus} menu.`);
    const name = clip(body.name, LIMITS.menuName);
    if (!name) return fail(c, 422, 'Zadejte název menu.');
    const template = body.template as MenuTemplate;
    let sections = template === 'weekly' ? weeklySections() : [];
    if (template === 'copy') {
        const source = findMenu(store, String(body.copyFrom ?? ''));
        if (!source) return fail(c, 404, 'Menu ke zkopírování nenalezeno.');
        sections = await cloneSections(c.env, source.sections);
    }
    const menu: Menu = { id: randomHex(16), name, note: '', sections };
    store.menus.push(menu);
    if (!store.activeId) store.activeId = menu.id;
    return save(c, store, `Menu „${name}“ vytvořeno.`);
});

app.put('/admin/menus/:id', async (c) => {
    const body = await json(c);
    const store = await readStore(c.env);
    const menu = findMenu(store, c.req.param('id'));
    if (!menu) return fail(c, 404, 'Menu nenalezeno.');
    const name = clip(body.name, LIMITS.menuName);
    if (!name) return fail(c, 422, 'Zadejte název menu.');
    menu.name = name;
    menu.note = clip(body.note, LIMITS.note);
    return save(c, store, 'Menu uloženo.');
});

app.post('/admin/menus/:id/activate', async (c) => {
    const store = await readStore(c.env);
    const menu = findMenu(store, c.req.param('id'));
    if (!menu) return fail(c, 404, 'Menu nenalezeno.');
    store.activeId = menu.id;
    return save(c, store, `Na webu se nyní zobrazuje „${menu.name}“.`);
});

app.delete('/admin/menus/:id', async (c) => {
    const store = await readStore(c.env);
    const menu = findMenu(store, c.req.param('id'));
    if (!menu) return fail(c, 404, 'Menu nenalezeno.');
    if (store.activeId === menu.id) return fail(c, 409, 'Aktivní menu nelze smazat – nejdřív aktivujte jiné.');
    await deleteSectionImages(c.env, menu.sections);
    store.menus = store.menus.filter((m) => m !== menu);
    return save(c, store, `Menu „${menu.name}“ smazáno.`);
});

/** Empties the dishes of all weekday sections (keeps e.g. "Stálá nabídka") – handy when starting a new week. */
app.post('/admin/menus/:id/clear-days', async (c) => {
    const store = await readStore(c.env);
    const menu = findMenu(store, c.req.param('id'));
    if (!menu) return fail(c, 404, 'Menu nenalezeno.');
    const days = menu.sections.filter((s) => s.weekday);
    await deleteSectionImages(c.env, days);
    days.forEach((s) => (s.items = []));
    return save(c, store, 'Jídla ze dnů v týdnu byla smazána (ostatní sekce zůstaly).');
});

// ---------- admin: sections ----------

app.post('/admin/menus/:id/sections', async (c) => {
    const body = await json(c);
    const store = await readStore(c.env);
    const menu = findMenu(store, c.req.param('id'));
    if (!menu) return fail(c, 404, 'Menu nenalezeno.');
    if (menu.sections.length >= LIMITS.sections) return fail(c, 409, `Menu může mít nejvýše ${LIMITS.sections} sekcí.`);
    const title = clip(body.title, LIMITS.sectionTitle);
    if (!title) return fail(c, 422, 'Zadejte název sekce.');
    menu.sections.push(newSection(title, parseWeekday(body.weekday)));
    return save(c, store, `Sekce „${title}“ přidána.`);
});

app.put('/admin/sections/:id', async (c) => {
    const body = await json(c);
    const store = await readStore(c.env);
    const found = findSection(store, c.req.param('id'));
    if (!found) return fail(c, 404, 'Sekce nenalezena.');
    const title = clip(body.title, LIMITS.sectionTitle);
    if (!title) return fail(c, 422, 'Zadejte název sekce.');
    found.section.title = title;
    found.section.weekday = parseWeekday(body.weekday);
    return save(c, store, 'Sekce uložena.');
});

app.post('/admin/sections/:id/move', async (c) => {
    const { direction } = await json(c);
    const store = await readStore(c.env);
    const found = findSection(store, c.req.param('id'));
    if (!found) return fail(c, 404, 'Sekce nenalezena.');
    move(found.menu.sections, found.index, direction);
    return save(c, store);
});

app.delete('/admin/sections/:id', async (c) => {
    const store = await readStore(c.env);
    const found = findSection(store, c.req.param('id'));
    if (!found) return fail(c, 404, 'Sekce nenalezena.');
    await deleteSectionImages(c.env, [found.section]);
    found.menu.sections.splice(found.index, 1);
    return save(c, store, `Sekce „${found.section.title}“ smazána.`);
});

// ---------- admin: dishes ----------

async function saveItem(c: Ctx, id: string | null) {
    const body = await c.req.parseBody();
    const data = Object.fromEntries(
        (Object.entries(FIELD_LIMITS) as [TextField, number][]).map(([f, max]) => [f, clip(body[f], max)]),
    ) as Record<TextField, string>;
    const category: Category = CATEGORIES.includes(body.category as Category) ? (body.category as Category) : 'Ostatní';
    if (!data.name) return fail(c, 422, 'Název jídla je povinný.');

    const store = await readStore(c.env);
    const target = findSection(store, String(body.section ?? ''));
    if (!target) return fail(c, 422, 'Vyberte sekci.');
    const current = id ? findItem(store, id) : null;
    if (id && !current) return fail(c, 404, 'Položka nenalezena.');
    if (!current && target.section.items.length >= LIMITS.items) return fail(c, 409, `Sekce může mít nejvýše ${LIMITS.items} jídel.`);

    let upload = null;
    if (body.image instanceof File && body.image.size > 0) {
        try {
            upload = await readUploadedImage(body.image);
        } catch (e) {
            return fail(c, 422, (e as Error).message);
        }
    }

    const existing: MenuItem | null = current ? current.section.items[current.index] : null;
    const item: MenuItem = { id: existing?.id ?? randomHex(16), image: existing?.image ?? null, ...data, category };
    if (upload || body.remove_image) {
        await deleteImage(c.env, existing?.image ?? null);
        item.image = upload ? await putImage(c.env, upload) : null;
    }
    if (current && current.section === target.section) {
        current.section.items[current.index] = item;
    } else {
        current?.section.items.splice(current.index, 1);
        target.section.items.push(item);
    }
    return save(c, store, id ? 'Změny uloženy.' : `Jídlo „${item.name}“ přidáno.`);
}

app.post('/admin/items', (c) => saveItem(c, null));
app.put('/admin/items/:id', (c) => saveItem(c, c.req.param('id')));

app.delete('/admin/items/:id', async (c) => {
    const store = await readStore(c.env);
    const found = findItem(store, c.req.param('id'));
    if (!found) return fail(c, 404, 'Položka nenalezena.');
    const [item] = found.section.items.splice(found.index, 1);
    await deleteImage(c.env, item.image);
    return save(c, store, `Jídlo „${item.name}“ smazáno.`);
});

app.post('/admin/items/:id/move', async (c) => {
    const { direction } = await json(c);
    const store = await readStore(c.env);
    const found = findItem(store, c.req.param('id'));
    if (!found) return fail(c, 404, 'Položka nenalezena.');
    move(found.section.items, found.index, direction);
    return save(c, store);
});

app.post('/admin/items/:id/copy', async (c) => {
    const { target } = await json(c);
    const store = await readStore(c.env);
    const found = findItem(store, c.req.param('id'));
    const dest = findSection(store, String(target ?? ''));
    if (!found) return fail(c, 404, 'Položka nenalezena.');
    if (!dest) return fail(c, 400, 'Neplatná sekce.');
    const source = found.section.items[found.index];
    dest.section.items.push({ ...source, id: randomHex(16), image: await copyImage(c.env, source.image) });
    return save(c, store, `Jídlo zkopírováno do „${dest.menu.name} › ${dest.section.title}“.`);
});

app.notFound((c) => fail(c, 404, 'Nenalezeno.'));
app.onError((err, c) => {
    console.error(err);
    if (err instanceof SyntaxError) return fail(c, 400, 'Neplatná data.');
    return c.json({ error: 'Omlouváme se, došlo k chybě serveru.' }, 500);
});

export default app;
