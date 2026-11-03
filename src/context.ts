import { createContext, useContext, useEffect } from 'react';
import { site } from '../shared/site';
import type { Flash } from './router';

export type AppState = {
    flashes: Flash[];
    setFlashes: (f: Flash[]) => void;
    user: string | null;
    setUser: (u: string | null) => void;
};

export const AppContext = createContext<AppState>(null!);
export const useApp = () => useContext(AppContext);

export function useTitle(title: string) {
    useEffect(() => {
        document.title = title ? `${title} | ${site.name}` : site.name;
    }, [title]);
}
