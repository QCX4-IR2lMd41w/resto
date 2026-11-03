import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS, type MenuTemplate } from '../../../shared/menu';
import { api, type StoreResult } from '../../api';
import { useApp, useTitle } from '../../context';
import { navigate, useLocation, useScrollToHash } from '../../router';
import { useStore } from '../../useMenu';
import SectionCard from './SectionCard';
import SectionEditor from './SectionEditor';
import { useAdminErrorHandler } from './useAdminAction';

const TEMPLATES: Record<MenuTemplate, string> = {
    weekly: 'Týdenní menu (Po–Pá + Stálá nabídka)',
    empty: 'Prázdné menu',
    copy: 'Kopie vybraného menu',
};

export default function Dashboard() {
    useTitle('Správa menu');
    const { store, setStore, error } = useStore();
    const { setFlashes } = useApp();
    const onError = useAdminErrorHandler();
    const location = useLocation();
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [newName, setNewName] = useState('');
    const [template, setTemplate] = useState<MenuTemplate>('weekly');
    useScrollToHash(store !== undefined);

    const requested = new URLSearchParams(location.split('?')[1] ?? '').get('menu');
    const menu = store?.menus.find((m) => m.id === requested) ?? store?.menus.find((m) => m.id === store.activeId) ?? store?.menus[0];

    useEffect(() => {
        setName(menu?.name ?? '');
        setNote(menu?.note ?? '');
    }, [menu?.id, menu?.name, menu?.note]);

    const select = (id: string, message?: string) =>
        navigate(`/admin?menu=${id}`, { replace: true, flash: message ? ['ok', message] : undefined });

    /** Runs an admin API call, shows its message and refreshes the data. Returns true on success. */
    async function run(action: () => Promise<StoreResult>, confirmText?: string) {
        if (confirmText && !window.confirm(confirmText)) return false;
        setBusy(true);
        try {
            const result = await action();
            setStore(result.store);
            setFlashes(result.message ? [['ok', result.message]] : []);
            return true;
        } catch (err) {
            onError(err);
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function createMenu(e: FormEvent) {
        e.preventDefault();
        const before = new Set(store?.menus.map((m) => m.id));
        let created: string | undefined;
        let message: string | undefined;
        const ok = await run(async () => {
            const result = await api.createMenu(newName, template, template === 'copy' ? menu?.id : undefined);
            created = result.store.menus.find((m) => !before.has(m.id))?.id;
            message = result.message;
            return result;
        });
        if (ok) {
            setNewName('');
            if (created) select(created, message);
        }
    }

    if (error) return <p className="flash flash-error">{error}</p>;
    if (!store || !menu) return <p className="muted">Načítám…</p>;
    const isActive = menu.id === store.activeId;
    const hasDays = menu.sections.some((s) => s.weekday);

    return (
        <>
            <h1>Správa menu</h1>

            <section className="card">
                <h2>Uložená menu</h2>
                <nav className="day-tabs menu-tabs">
                    {store.menus.map((m) => (
                        <a key={m.id} href={`/admin?menu=${m.id}`} className={m.id === menu.id ? 'active' : ''}
                            onClick={(e) => { e.preventDefault(); select(m.id); }}>
                            {m.name}{m.id === store.activeId && ' ★'}
                        </a>
                    ))}
                </nav>
                <p className="muted small">★ = menu zobrazené na webu. Kliknutím na název menu otevřete jeho úpravy.</p>
                <form className="row" onSubmit={createMenu}>
                    <label className="grow">Nové menu
                        <input type="text" required maxLength={LIMITS.menuName} value={newName} onChange={(e) => setNewName(e.target.value)}
                            placeholder="např. Týden 10. – 14. 11., Vánoční menu" />
                    </label>
                    <label>Vytvořit jako
                        <select value={template} onChange={(e) => setTemplate(e.target.value as MenuTemplate)}>
                            {(Object.keys(TEMPLATES) as MenuTemplate[]).map((t) => (
                                <option key={t} value={t}>{t === 'copy' ? `Kopie „${menu.name}“` : TEMPLATES[t]}</option>
                            ))}
                        </select>
                    </label>
                    <button type="submit" className="btn" disabled={busy || store.menus.length >= LIMITS.menus}>Vytvořit</button>
                </form>
            </section>

            <section className={`card${isActive ? ' today' : ''}`}>
                <div className="day-head">
                    <h2>{menu.name} {isActive ? <span className="badge">zobrazeno na webu</span> : <span className="badge badge-muted">uloženo</span>}</h2>
                    <div className="actions">
                        {!isActive && (
                            <button type="button" className="btn" disabled={busy}
                                onClick={() => run(() => api.activateMenu(menu.id))}>Zobrazit na webu</button>
                        )}
                        {hasDays && (
                            <button type="button" className="btn btn-secondary" disabled={busy}
                                onClick={() => run(() => api.clearDays(menu.id), 'Smazat všechna jídla ze dnů v týdnu? Ostatní sekce (např. Stálá nabídka) zůstanou.')}>
                                Vyprázdnit dny
                            </button>
                        )}
                        <button type="button" className="btn btn-danger" disabled={busy || isActive}
                            title={isActive ? 'Aktivní menu nelze smazat – nejdřív zobrazte na webu jiné.' : undefined}
                            onClick={() => run(() => api.deleteMenu(menu.id), `Opravdu smazat menu „${menu.name}“ včetně všech jídel a obrázků?`)}>
                            Smazat menu
                        </button>
                    </div>
                </div>
                <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => api.updateMenu(menu.id, name, note)); }}>
                    <label className="grow">Název menu
                        <input type="text" required maxLength={LIMITS.menuName} value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label className="grow">Poznámka (zobrazí se pod názvem)
                        <input type="text" maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="např. Polední menu 3. – 7. 11. 2026" />
                    </label>
                    <button type="submit" className="btn" disabled={busy}>Uložit</button>
                </form>
            </section>

            {menu.sections.length > 1 && (
                <nav className="day-tabs">
                    {menu.sections.map((s) => (
                        <a key={s.id} href={`#sekce-${s.id}`}>{s.title} ({s.items.length})</a>
                    ))}
                </nav>
            )}

            {menu.sections.map((section, i) => (
                <SectionCard key={section.id} store={store} menuId={menu.id} section={section} index={i}
                    count={menu.sections.length} busy={busy} run={run} />
            ))}

            <section className="card">
                <h2>Přidat sekci</h2>
                <p className="muted small">
                    Sekce může být cokoliv s názvem (Polévky, Stálá nabídka…). Pokud název začíná dnem v týdnu (např. „Pondělí 3. 11.“),
                    den se nastaví automaticky a na úvodní stránce se sekce ukáže jako dnešní menu.
                </p>
                <SectionEditor submitLabel="Přidat sekci" busy={busy || menu.sections.length >= LIMITS.sections}
                    onSubmit={(title, weekday) => run(() => api.addSection(menu.id, { title, weekday }))} />
            </section>
        </>
    );
}
