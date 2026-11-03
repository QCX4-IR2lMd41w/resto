import type { ReactNode } from 'react';
import { site } from '../../shared/site';
import { api } from '../api';
import { useApp } from '../context';
import { Link, navigate } from '../router';

const ALLERGENS = '1 lepek, 2 korýši, 3 vejce, 4 ryby, 5 arašídy, 6 sója, 7 mléko, 8 skořápkové plody, 9 celer, 10 hořčice, 11 sezam, 12 oxid siřičitý, 13 vlčí bob, 14 měkkýši.';

export default function Layout({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
    const { flashes, user, setUser } = useApp();

    async function logout() {
        await api.logout().catch(() => undefined);
        setUser(null);
        navigate('/admin/login', { flash: ['ok', 'Byli jste odhlášeni.'] });
    }

    return (
        <div className={isAdmin ? 'admin' : 'public'}>
            <header className="site-header">
                <div className="container header-inner">
                    <Link className="brand" to="/">{site.name}</Link>
                    <nav>
                        {isAdmin && user && (
                            <>
                                <Link to="/admin">Správa menu</Link>
                                <a href="/menu" target="_blank" rel="noopener">Zobrazit web</a>
                                <button type="button" className="link" onClick={logout}>Odhlásit ({user})</button>
                            </>
                        )}
                        {!isAdmin && (
                            <>
                                <Link to="/">Úvod</Link>
                                <Link to="/menu">Menu</Link>
                                <a href="/#kontakt" onClick={(e) => { e.preventDefault(); navigate('/#kontakt'); document.getElementById('kontakt')?.scrollIntoView(); }}>Kontakt</a>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            <main className="container">
                {flashes.map(([type, msg], i) => (
                    <div key={i} className={`flash flash-${type}`}>{msg}</div>
                ))}
                {children}
            </main>
            <footer className="site-footer">
                <div className="container">
                    <p>&copy; {new Date().getFullYear()} {site.name} &middot; {site.address} &middot; {site.phone}</p>
                    {!isAdmin && (
                        <p className="small">
                            Seznam alergenů: {ALLERGENS} <Link to="/admin" className="admin-link">Správa</Link>
                        </p>
                    )}
                </div>
            </footer>
        </div>
    );
}
