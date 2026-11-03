import { MAX_UPLOAD_BYTES, emptyMenu, type Menu, type SectionCode } from '../shared/menu';
import type { Bindings } from './auth';

const MENU_KEY = 'menu';
const IMAGE_NAME = /^[a-f0-9]{32}$/;

export function randomHex(bytes = 16) {
    return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readMenu(env: Bindings): Promise<Menu> {
    const stored = await env.MENU_KV.get<Partial<Menu>>(MENU_KEY, { type: 'json' });
    const empty = emptyMenu();
    return { week_label: stored?.week_label ?? '', days: { ...empty.days, ...(stored?.days ?? {}) } };
}

export async function writeMenu(env: Bindings, menu: Menu) {
    await env.MENU_KV.put(MENU_KEY, JSON.stringify(menu));
}

export function findItem(menu: Menu, id: string): [SectionCode, number] | null {
    for (const [day, items] of Object.entries(menu.days) as [SectionCode, Menu['days'][SectionCode]][]) {
        const i = items.findIndex((item) => item.id === id);
        if (i !== -1) return [day, i];
    }
    return null;
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
