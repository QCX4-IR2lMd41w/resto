import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { useApp } from '../context';
import { navigate } from '../router';

/** Renders admin pages only for a logged-in maintainer; otherwise redirects to the login page. */
export default function AdminGuard({ children }: { children: ReactNode }) {
    const { user, setUser } = useApp();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let active = true;
        api.session()
            .then((s) => {
                if (!active) return;
                setUser(s.user);
                if (s.user) setChecked(true);
                else navigate('/admin/login', { replace: true, flash: ['error', 'Přihlaste se prosím.'] });
            })
            .catch((e) => active && navigate('/admin/login', { replace: true, flash: ['error', e.message] }));
        return () => {
            active = false;
        };
    }, [setUser]);

    return checked && user ? children : <p className="muted">Načítám…</p>;
}
