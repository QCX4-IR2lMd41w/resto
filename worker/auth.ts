import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';

export type Bindings = { MENU_KV: KVNamespace; USERS?: string; SESSION_SECRET?: string };
export type AppEnv = { Bindings: Bindings; Variables: { user: string } };
type Ctx = Context<AppEnv>;

const SESSION_COOKIE = 'resto_session';
const SESSION_SECONDS = 8 * 3600;
const MAX_USERS = 5;
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_SECONDS = 15 * 60;
const PBKDF2_MAX_ITERATIONS = 100_000; // maximum supported by Workers
const enc = new TextEncoder();

const b64u = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) =>
    Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (ch) => ch.charCodeAt(0));

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// ---------- passwords (format: pbkdf2_sha256:<iterations>:<salt>:<hash>, created by scripts/users.mjs) ----------

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

async function verifyPassword(password: string, stored: string) {
    const [algo, iter, salt, hash] = stored.split(':');
    const iterations = Number(iter);
    if (algo !== 'pbkdf2_sha256' || !salt || !hash || !(iterations > 0 && iterations <= PBKDF2_MAX_ITERATIONS)) return false;
    try {
        return timingSafeEqual(await pbkdf2(password, unb64u(salt), iterations), unb64u(hash));
    } catch {
        return false;
    }
}

/** Users come from the USERS secret: {"name": "<hash>", ...}; only the first MAX_USERS are honoured. */
export function loadUsers(env: Bindings): Record<string, string> {
    let users: Record<string, unknown> = {};
    try {
        users = JSON.parse(env.USERS || '{}');
    } catch {
        console.error('USERS secret is not valid JSON');
    }
    return Object.fromEntries(
        Object.entries(users)
            .filter((e): e is [string, string] => /^[a-zA-Z0-9._-]{3,32}$/.test(e[0]) && typeof e[1] === 'string')
            .slice(0, MAX_USERS),
    );
}

const DUMMY_HASH = 'pbkdf2_sha256:100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Returns the stored hash on success. Unknown users cost the same time as known ones. */
export async function checkCredentials(env: Bindings, username: string, password: string) {
    const stored = loadUsers(env)[username];
    const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
    return ok && stored ? stored : null;
}

// ---------- signed, stateless session cookie ----------

async function hmac(env: Bindings, data: string) {
    const secret = env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set (at least 32 characters).');
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// Binds the session to the current password hash: changing a password or removing a user logs them out.
const fingerprint = async (env: Bindings, hash: string) => b64u((await hmac(env, `pw:${hash}`)).slice(0, 16));

function cookieOptions(c: Ctx, maxAge?: number): CookieOptions {
    const url = new URL(c.req.url);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    return { path: '/', httpOnly: true, secure: !local, sameSite: 'Strict', maxAge };
}

export async function startSession(c: Ctx, username: string, hash: string) {
    const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const payload = b64u(enc.encode(JSON.stringify({ u: username, pw: await fingerprint(c.env, hash), exp })));
    const sig = b64u(await hmac(c.env, `session:${payload}`));
    setCookie(c, SESSION_COOKIE, `${payload}.${sig}`, cookieOptions(c, SESSION_SECONDS));
}

export function endSession(c: Ctx) {
    deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

export async function currentUser(c: Ctx): Promise<string | null> {
    const [payload, sig] = (getCookie(c, SESSION_COOKIE) ?? '').split('.');
    if (!payload || !sig) return null;
    try {
        if (!timingSafeEqual(unb64u(sig), await hmac(c.env, `session:${payload}`))) return null;
        const data = JSON.parse(new TextDecoder().decode(unb64u(payload)));
        const hash = loadUsers(c.env)[data.u];
        if (hash && data.exp > Date.now() / 1000 && data.pw === (await fingerprint(c.env, hash))) return data.u;
    } catch (e) {
        if (e instanceof Error && e.message.startsWith('SESSION_SECRET')) throw e;
    }
    endSession(c);
    return null;
}

// ---------- login throttling (per IP, stored in KV with TTL) ----------

async function attemptsKey(c: Ctx) {
    const ip = c.req.header('CF-Connecting-IP') ?? 'local';
    return `fail:${b64u(await crypto.subtle.digest('SHA-256', enc.encode(ip)))}`;
}

export async function isLockedOut(c: Ctx) {
    return Number(await c.env.MENU_KV.get(await attemptsKey(c))) >= MAX_LOGIN_FAILURES;
}

export async function recordFailure(c: Ctx) {
    const key = await attemptsKey(c);
    const count = Number(await c.env.MENU_KV.get(key)) + 1;
    await c.env.MENU_KV.put(key, String(count), { expirationTtl: LOCKOUT_SECONDS });
}

export async function clearFailures(c: Ctx) {
    await c.env.MENU_KV.delete(await attemptsKey(c));
}
