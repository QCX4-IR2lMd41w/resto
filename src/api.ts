import type { DayCode, Menu, MenuStore, MenuTemplate } from '../shared/menu';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export type StoreResult = { store: MenuStore; message?: string };
export type Session = { user: string | null; hasUsers: boolean };

async function request<T>(method: string, path: string, body?: object | FormData): Promise<T> {
    // The custom header is required by the API for every state-changing request (CSRF protection).
    const headers: Record<string, string> = { 'X-Requested-With': 'resto' };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
        payload = body;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    let res: Response;
    try {
        res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
    } catch {
        throw new ApiError('Nepodařilo se spojit se serverem.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data?.error ?? 'Došlo k chybě serveru.', res.status);
    return data as T;
}

type Direction = 'up' | 'down';
type SectionInput = { title: string; weekday: DayCode | null };

export const api = {
    activeMenu: () => request<Menu | null>('GET', '/menu'),
    session: () => request<Session>('GET', '/session'),
    login: (username: string, password: string) => request<{ user: string }>('POST', '/login', { username, password }),
    logout: () => request<{ ok: true }>('POST', '/logout'),

    store: () => request<MenuStore>('GET', '/admin/store'),
    createMenu: (name: string, template: MenuTemplate, copyFrom?: string) => request<StoreResult>('POST', '/admin/menus', { name, template, copyFrom }),
    updateMenu: (id: string, name: string, note: string) => request<StoreResult>('PUT', `/admin/menus/${id}`, { name, note }),
    activateMenu: (id: string) => request<StoreResult>('POST', `/admin/menus/${id}/activate`),
    deleteMenu: (id: string) => request<StoreResult>('DELETE', `/admin/menus/${id}`),
    clearDays: (id: string) => request<StoreResult>('POST', `/admin/menus/${id}/clear-days`),

    addSection: (menuId: string, s: SectionInput) => request<StoreResult>('POST', `/admin/menus/${menuId}/sections`, s),
    updateSection: (id: string, s: SectionInput) => request<StoreResult>('PUT', `/admin/sections/${id}`, s),
    moveSection: (id: string, direction: Direction) => request<StoreResult>('POST', `/admin/sections/${id}/move`, { direction }),
    deleteSection: (id: string) => request<StoreResult>('DELETE', `/admin/sections/${id}`),

    createItem: (data: FormData) => request<StoreResult>('POST', '/admin/items', data),
    updateItem: (id: string, data: FormData) => request<StoreResult>('PUT', `/admin/items/${id}`, data),
    deleteItem: (id: string) => request<StoreResult>('DELETE', `/admin/items/${id}`),
    moveItem: (id: string, direction: Direction) => request<StoreResult>('POST', `/admin/items/${id}/move`, { direction }),
    copyItem: (id: string, target: string) => request<StoreResult>('POST', `/admin/items/${id}/copy`, { target }),
};
