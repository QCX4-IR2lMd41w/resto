import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import { useApp, useTitle } from '../../context';
import { navigate } from '../../router';

export default function Login() {
    useTitle('Přihlášení');
    const { setFlashes, setUser } = useApp();
    const [hasUsers, setHasUsers] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.session()
            .then((s) => {
                if (s.user) {
                    setUser(s.user);
                    navigate('/admin', { replace: true });
                }
                setHasUsers(s.hasUsers);
            })
            .catch(() => undefined);
    }, [setUser]);

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
            const { user } = await api.login(String(form.get('username')), String(form.get('password')));
            setUser(user);
            navigate('/admin');
        } catch (err) {
            setFlashes([['error', (err as Error).message]]);
            setBusy(false);
        }
    }

    return (
        <section className="card narrow">
            <h1>Přihlášení správce</h1>
            {!hasUsers && (
                <div className="flash flash-error">
                    Zatím není nastaven žádný správce. Vytvořte ho příkazem <code>npm run users add jmeno</code>.
                </div>
            )}
            <form className="form" onSubmit={submit}>
                <label>Uživatelské jméno
                    <input type="text" name="username" required autoComplete="username" autoFocus maxLength={32} />
                </label>
                <label>Heslo
                    <input type="password" name="password" required autoComplete="current-password" />
                </label>
                <button type="submit" className="btn" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit'}</button>
            </form>
        </section>
    );
}
