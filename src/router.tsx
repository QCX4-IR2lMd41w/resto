import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal client-side router (a handful of routes doesn't justify a routing library).

export type Flash = ['ok' | 'error', string];

const listeners = new Set<() => void>();
let pendingFlashes: Flash[] = [];

function subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener('popstate', cb);
    return () => {
        listeners.delete(cb);
        window.removeEventListener('popstate', cb);
    };
}

const snapshot = () => location.pathname + location.search;

export const useLocation = () => useSyncExternalStore(subscribe, snapshot);

export function navigate(to: string, opts: { flash?: Flash; replace?: boolean } = {}) {
    if (opts.flash) pendingFlashes.push(opts.flash);
    history[opts.replace ? 'replaceState' : 'pushState'](null, '', to);
    listeners.forEach((l) => l());
    if (!new URL(to, location.href).hash) window.scrollTo(0, 0);
}

/** Flash messages queued by navigate(); read once by the layout after a route change. */
export function takeFlashes() {
    const f = pendingFlashes;
    pendingFlashes = [];
    return f;
}

/** Scrolls to the element referenced by location.hash once the page content is ready. */
export function useScrollToHash(ready: boolean) {
    useEffect(() => {
        if (ready && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    }, [ready]);
}

export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
    const handle = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target) return;
        e.preventDefault();
        navigate(to);
    };
    return <a href={to} onClick={handle} {...props} />;
}
