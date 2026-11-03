export const DAYS = {
    po: 'Pondělí', ut: 'Úterý', st: 'Středa', ct: 'Čtvrtek',
    pa: 'Pátek', so: 'Sobota', ne: 'Neděle',
} as const;
export const SECTIONS = { ...DAYS, stala: 'Stálá nabídka' } as const;
export const CATEGORIES = ['Polévka', 'Hlavní jídlo', 'Salát', 'Dezert', 'Ostatní'] as const;
export const FIELD_LIMITS = { name: 120, description: 500, price: 20, weight: 20, allergens: 40 } as const;
export const WEEK_LABEL_LIMIT = 80;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type DayCode = keyof typeof DAYS;
export type SectionCode = keyof typeof SECTIONS;
export type Category = (typeof CATEGORIES)[number];
export type TextField = keyof typeof FIELD_LIMITS;

export interface MenuItem extends Record<TextField, string> {
    id: string;
    category: Category;
    image: string | null;
}

export interface Menu {
    week_label: string;
    days: Record<SectionCode, MenuItem[]>;
}

export const SECTION_CODES = Object.keys(SECTIONS) as SectionCode[];
export const isSection = (v: unknown): v is SectionCode => typeof v === 'string' && Object.hasOwn(SECTIONS, v);

export function emptyMenu(): Menu {
    return { week_label: '', days: Object.fromEntries(SECTION_CODES.map((k) => [k, []])) as unknown as Menu['days'] };
}

const TZ = 'Europe/Prague';
const WEEKDAY_CODES: Record<string, DayCode> = { Mon: 'po', Tue: 'ut', Wed: 'st', Thu: 'ct', Fri: 'pa', Sat: 'so', Sun: 'ne' };

export function todayCode(): DayCode {
    return WEEKDAY_CODES[new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date())];
}

export function todayDate(): string {
    return new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date());
}

export const imageUrl = (name: string | null | undefined) => (name && /^[a-f0-9]{32}$/.test(name) ? `/api/img/${name}` : null);
