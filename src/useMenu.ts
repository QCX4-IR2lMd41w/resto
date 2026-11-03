import { useEffect, useState } from 'react';
import type { Menu } from '../shared/menu';
import { api } from './api';

export function useMenu() {
    const [menu, setMenu] = useState<Menu | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        api.menu()
            .then((m) => active && setMenu(m))
            .catch((e) => active && setError(e.message));
        return () => {
            active = false;
        };
    }, []);
    return { menu, setMenu, error };
}
