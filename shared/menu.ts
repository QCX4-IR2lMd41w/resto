export const DAYS = {
    po: 'Pondělí', ut: 'Úterý', st: 'Středa', ct: 'Čtvrtek',
    pa: 'Pátek', so: 'Sobota', ne: 'Neděle',
} as const;
export const CATEGORIES = ['Polévka', 'Hlavní jídlo', 'Salát', 'Dezert', 'Nápoje', 'Ostatní'] as const;
export const FIELD_LIMITS = { name: 120, description: 500, price: 20, weight: 20, allergens: 40 } as const;
export const LIMITS = { menuName: 60, note: 120, sectionTitle: 60, menus: 20, sections: 40, items: 60 } as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type DayCode = keyof typeof DAYS;
export type Category = (typeof CATEGORIES)[number];
export type TextField = keyof typeof FIELD_LIMITS;

export interface MenuItem extends Record<TextField, string> {
    id: string;
    category: Category;
    image: string | null;
}

/** A titled group of dishes; optionally bound to a day of the week ("Pondělí", "Úterý 20. 10." …). */
export interface Section {
    id: string;
    title: string;
    weekday: DayCode | null;
    items: MenuItem[];
}

export interface Menu {
    id: string;
    name: string;
    note: string;
    sections: Section[];
}

/** All stored menus; exactly one (activeId) is shown on the public web. */
export interface MenuStore {
    activeId: string | null;
    menus: Menu[];
}

export type MenuTemplate = 'empty' | 'weekly' | 'copy';

export const DAY_CODES = Object.keys(DAYS) as DayCode[];
export const isDay = (v: unknown): v is DayCode => typeof v === 'string' && Object.hasOwn(DAYS, v);

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const DAY_NAMES_NORMALIZED = DAY_CODES.map((code) => [code, normalize(DAYS[code])] as const);

/** Recognises a weekday from a section title that starts with a Czech day name (with or without diacritics). */
export function detectWeekday(title: string): DayCode | null {
    const t = normalize(title);
    return DAY_NAMES_NORMALIZED.find(([, name]) => t === name || t.startsWith(`${name} `) || t.startsWith(`${name},`) || t.startsWith(`${name}:`))?.[0] ?? null;
}

const TZ = 'Europe/Prague';
const WEEKDAY_CODES: Record<string, DayCode> = { Mon: 'po', Tue: 'ut', Wed: 'st', Thu: 'ct', Fri: 'pa', Sat: 'so', Sun: 'ne' };

export function todayCode(): DayCode {
    return WEEKDAY_CODES[new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date())];
}

export function todayDate(): string {
    return new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date());
}

export const activeMenu = (store: MenuStore) => store.menus.find((m) => m.id === store.activeId) ?? null;

export const imageUrl = (name: string | null | undefined) => (name && /^[a-f0-9]{32}$/.test(name) ? `/api/img/${name}` : null);
