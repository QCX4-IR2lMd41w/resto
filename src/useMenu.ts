import { useEffect, useState } from 'react';
import type { Menu, MenuStore } from '../shared/menu';
import { api } from './api';

function useLoad<T>(load: () => Promise<T>) {
    const [data, setData] = useState<T | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        load()
            .then((d) => active && setData(d))
            .catch((e) => active && setError(e.message));
        return () => {
            active = false;
        };
    }, [load]);
    return { data, setData, error };
}

/** The menu currently shown on the public web (null when none is active). */
export function useActiveMenu() {
    const { data, error } = useLoad<Menu | null>(api.activeMenu);
    return { menu: data, error };
}

/** All stored menus – admin only. */
export function useStore() {
    const { data, setData, error } = useLoad<MenuStore>(api.store);
    return { store: data, setStore: setData, error };
}
