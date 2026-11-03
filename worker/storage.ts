import {
    DAYS, DAY_CODES, MAX_UPLOAD_BYTES, isDay, type Menu, type MenuItem, type MenuStore, type Section,
} from '../shared/menu';
import type { Bindings } from './auth';

const STORE_KEY = 'menus';
const LEGACY_MENU_KEY = 'menu'; // single weekly menu used before multiple menus existed
const IMAGE_NAME = /^[a-f0-9]{32}$/;

export function randomHex(bytes = 16) {
    return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const newSection = (title: string, weekday: Section['weekday'] = null): Section =>
    ({ id: randomHex(16), title, weekday, items: [] });

/** Monday–Friday plus "Stálá nabídka" – the default layout of a weekly lunch menu. */
export function weeklySections(): Section[] {
    return [...DAY_CODES.slice(0, 5).map((code) => newSection(DAYS[code], code)), newSection('Stálá nabídka')];
}

type LegacyMenu = { week_label?: string; days?: Record<string, MenuItem[]> };

/** Converts the old {week_label, days: {po: [...], …, stala: [...]}} format into a store with one weekly menu. */
function fromLegacy(legacy: LegacyMenu): MenuStore {
    const days = legacy.days ?? {};
    const sections = DAY_CODES
        .filter((code) => ['po', 'ut', 'st', 'ct', 'pa'].includes(code) || days[code]?.length)
        .map((code) => ({ ...newSection(DAYS[code], code), items: days[code] ?? [] }));
    if (days.stala?.length) sections.push({ ...newSection('Stálá nabídka'), items: days.stala });
    const menu: Menu = { id: randomHex(16), name: 'Týdenní menu', note: legacy.week_label ?? '', sections };
    return { activeId: menu.id, menus: [menu] };
}

export async function readStore(env: Bindings): Promise<MenuStore> {
    const store = await env.MENU_KV.get<MenuStore>(STORE_KEY, { type: 'json' });
    if (store) return store;
    // First run (or data from the single-menu version): create the store once so ids stay stable.
    const legacy = await env.MENU_KV.get<LegacyMenu>(LEGACY_MENU_KEY, { type: 'json' });
    const menu: Menu = { id: randomHex(16), name: 'Týdenní menu', note: '', sections: weeklySections() };
    const created = legacy ? fromLegacy(legacy) : { activeId: menu.id, menus: [menu] };
    await writeStore(env, created);
    return created;
}

export async function writeStore(env: Bindings, store: MenuStore) {
    await env.MENU_KV.put(STORE_KEY, JSON.stringify(store));
}

export const findMenu = (store: MenuStore, id: string) => store.menus.find((m) => m.id === id) ?? null;

export function findSection(store: MenuStore, id: string): { menu: Menu; section: Section; index: number } | null {
    for (const menu of store.menus) {
        const index = menu.sections.findIndex((s) => s.id === id);
        if (index !== -1) return { menu, section: menu.sections[index], index };
    }
    return null;
}

export function findItem(store: MenuStore, id: string): { menu: Menu; section: Section; index: number } | null {
    for (const menu of store.menus) {
        for (const section of menu.sections) {
            const index = section.items.findIndex((item) => item.id === id);
            if (index !== -1) return { menu, section, index };
        }
    }
    return null;
}

export const parseWeekday = (v: unknown) => (isDay(v) ? v : null);

/** Deep copy with fresh ids; images are duplicated so deleting one menu never breaks another. */
export async function cloneSections(env: Bindings, sections: Section[]): Promise<Section[]> {
    return Promise.all(sections.map(async (s) => ({
        ...s,
        id: randomHex(16),
        items: await Promise.all(s.items.map(async (item) => ({ ...item, id: randomHex(16), image: await copyImage(env, item.image) }))),
    })));
}

export async function deleteSectionImages(env: Bindings, sections: Section[]) {
    await Promise.all(sections.flatMap((s) => s.items.map((item) => deleteImage(env, item.image))));
}

// ---------- images (stored in the same KV namespace) ----------

type Image = { bytes: Uint8Array | ArrayBuffer; type: string };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));
const SIGNATURES: [string, (b: Uint8Array) => boolean][] = [
    ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
    ['image/png', (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)],
    ['image/gif', (b) => ascii(b, 0, 4) === 'GIF8'],
    ['image/webp', (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP'],
];

/** Validates an uploaded file by size and magic bytes (never trusts the client-provided type). */
export async function readUploadedImage(file: File): Promise<Image> {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Obrázek je příliš velký (max. 5 MB).');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const match = SIGNATURES.find(([, test]) => bytes.length > 12 && test(bytes));
    if (!match) throw new Error('Soubor není platný obrázek (povoleno JPG, PNG, WEBP, GIF).');
    return { bytes, type: match[0] };
}

export const validImageName = (name: unknown): name is string => typeof name === 'string' && IMAGE_NAME.test(name);

export async function putImage(env: Bindings, { bytes, type }: Image) {
    const name = randomHex(16);
    await env.MENU_KV.put(`img:${name}`, bytes, { metadata: { type } });
    return name;
}

export function getImage(env: Bindings, name: string) {
    return env.MENU_KV.getWithMetadata<{ type: string }>(`img:${name}`, { type: 'arrayBuffer', cacheTtl: 86400 });
}

export async function copyImage(env: Bindings, name: string | null) {
    if (!validImageName(name)) return null;
    const { value, metadata } = await getImage(env, name);
    return value && metadata ? putImage(env, { bytes: value, type: metadata.type }) : null;
}

export async function deleteImage(env: Bindings, name: string | null) {
    if (validImageName(name)) await env.MENU_KV.delete(`img:${name}`);
}
