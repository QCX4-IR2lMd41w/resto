import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppContext } from './context';
import { navigate, takeFlashes, useLocation, type Flash } from './router';
import Layout from './components/Layout';
import AdminGuard from './components/AdminGuard';
import Home from './pages/Home';
import WeeklyMenu from './pages/WeeklyMenu';
import NotFound from './pages/NotFound';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ItemForm from './pages/admin/ItemForm';

function route(pathname: string): { page: ReactNode; isAdmin: boolean } {
    if (pathname === '/') return { page: <Home />, isAdmin: false };
    if (pathname === '/menu') return { page: <WeeklyMenu />, isAdmin: false };
    if (pathname === '/admin/login') return { page: <Login />, isAdmin: true };
    if (pathname === '/admin') return { page: <AdminGuard><Dashboard /></AdminGuard>, isAdmin: true };
    if (pathname === '/admin/item/new') return { page: <AdminGuard><ItemForm /></AdminGuard>, isAdmin: true };
    const edit = pathname.match(/^\/admin\/item\/([a-f0-9]{32})$/);
    if (edit) return { page: <AdminGuard><ItemForm id={edit[1]} key={edit[1]} /></AdminGuard>, isAdmin: true };
    return { page: <NotFound />, isAdmin: pathname.startsWith('/admin') };
}

export default function App() {
    const location = useLocation();
    const pathname = location.split('?')[0].replace(/(.)\/+$/, '$1');
    const [flashes, setFlashes] = useState<Flash[]>([]);
    const [user, setUser] = useState<string | null>(null);

    useEffect(() => {
        setFlashes(takeFlashes());
        if (pathname === '/menu.php' || pathname === '/index.php') navigate(pathname === '/menu.php' ? '/menu' : '/', { replace: true });
    }, [location, pathname]);

    const state = useMemo(() => ({ flashes, setFlashes, user, setUser }), [flashes, user]);
    const { page, isAdmin } = route(pathname);

    return (
        <AppContext.Provider value={state}>
            <Layout isAdmin={isAdmin}>{page}</Layout>
        </AppContext.Provider>
    );
}
