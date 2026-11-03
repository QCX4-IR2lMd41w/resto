import type { Menu, SectionCode } from '../shared/menu';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export type MenuResult = { menu: Menu; message?: string };
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
    if (!res.ok) throw new ApiError(data.error ?? 'Došlo k chybě serveru.', res.status);
    return data as T;
}

export const api = {
    menu: () => request<Menu>('GET', '/menu'),
    session: () => request<Session>('GET', '/session'),
    login: (username: string, password: string) => request<{ user: string }>('POST', '/login', { username, password }),
    logout: () => request<{ ok: true }>('POST', '/logout'),
    setWeekLabel: (week_label: string) => request<MenuResult>('PUT', '/admin/week', { week_label }),
    clearWeek: () => request<MenuResult>('POST', '/admin/clear'),
    createItem: (data: FormData) => request<MenuResult>('POST', '/admin/items', data),
    updateItem: (id: string, data: FormData) => request<MenuResult>('PUT', `/admin/items/${id}`, data),
    deleteItem: (id: string) => request<MenuResult>('DELETE', `/admin/items/${id}`),
    moveItem: (id: string, direction: 'up' | 'down') => request<MenuResult>('POST', `/admin/items/${id}/move`, { direction }),
    copyItem: (id: string, target: SectionCode) => request<MenuResult>('POST', `/admin/items/${id}/copy`, { target }),
};
