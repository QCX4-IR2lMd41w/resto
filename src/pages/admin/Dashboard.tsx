import { useEffect, useState, type FormEvent } from 'react';
import { SECTIONS, SECTION_CODES, WEEK_LABEL_LIMIT, imageUrl, todayCode, type MenuItem, type SectionCode } from '../../../shared/menu';
import { api, type MenuResult } from '../../api';
import { useApp, useTitle } from '../../context';
import { Link, useScrollToHash } from '../../router';
import { useMenu } from '../../useMenu';
import { useAdminErrorHandler } from './useAdminAction';

const truncate = (s: string, n: number) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);

export default function Dashboard() {
    useTitle('Správa menu');
    const { menu, setMenu, error } = useMenu();
    const { setFlashes } = useApp();
    const onError = useAdminErrorHandler();
    const [weekLabel, setWeekLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const today = todayCode();
    useScrollToHash(menu !== null);

    useEffect(() => {
        if (menu) setWeekLabel(menu.week_label);
    }, [menu]);

    async function run(action: () => Promise<MenuResult>, confirmText?: string) {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        try {
            const result = await action();
            setMenu(result.menu);
            setFlashes(result.message ? [['ok', result.message]] : []);
        } catch (err) {
            onError(err);
        } finally {
            setBusy(false);
        }
    }

    function saveWeek(e: FormEvent) {
        e.preventDefault();
        run(() => api.setWeekLabel(weekLabel));
    }

    if (error) return <p className="flash flash-error">{error}</p>;
    if (!menu) return <p className="muted">Načítám…</p>;

    const row = (code: SectionCode, items: MenuItem[], item: MenuItem, i: number) => {
        const img = imageUrl(item.image);
        const copy = (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const target = new FormData(e.currentTarget).get('target') as SectionCode;
            run(() => api.copyItem(item.id, target));
        };
        return (
            <tr key={item.id}>
                <td className="thumb">{img && <img src={img} alt="" />}</td>
                <td>
                    <strong>{item.name}</strong>
                    {item.description && <><br /><span className="muted small">{truncate(item.description, 90)}</span></>}
                </td>
                <td>{item.category}</td>
                <td className="nowrap">{item.price}</td>
                <td className="actions">
                    <button type="button" className="btn-icon" title="Posunout nahoru" disabled={busy || i === 0}
                        onClick={() => run(() => api.moveItem(item.id, 'up'))}>&uarr;</button>
                    <button type="button" className="btn-icon" title="Posunout dolů" disabled={busy || i === items.length - 1}
                        onClick={() => run(() => api.moveItem(item.id, 'down'))}>&darr;</button>
                    <Link className="btn btn-small" to={`/admin/item/${item.id}`}>Upravit</Link>
                    <form className="inline copy-form" onSubmit={copy}>
                        <select name="target" aria-label="Kopírovat do">
                            {SECTION_CODES.filter((c) => c !== code).map((c) => <option key={c} value={c}>{SECTIONS[c]}</option>)}
                        </select>
                        <button type="submit" className="btn btn-small btn-secondary" disabled={busy}>Kopírovat</button>
                    </form>
                    <button type="button" className="btn btn-small btn-danger" disabled={busy}
                        onClick={() => run(() => api.deleteItem(item.id), `Opravdu smazat „${item.name}“?`)}>Smazat</button>
                </td>
            </tr>
        );
    };

    return (
        <>
            <h1>Správa týdenního menu</h1>

            <section className="card toolbar">
                <form className="row" onSubmit={saveWeek}>
                    <label className="grow">Označení týdne (zobrazí se nad menu)
                        <input type="text" maxLength={WEEK_LABEL_LIMIT} value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)}
                            placeholder="např. Menu 21. – 25. 10. 2026" />
                    </label>
                    <button type="submit" className="btn" disabled={busy}>Uložit</button>
                </form>
                <button type="button" className="btn btn-danger" disabled={busy}
                    onClick={() => run(api.clearWeek, 'Opravdu smazat celé týdenní menu včetně obrázků? (Stálá nabídka zůstane.)')}>
                    Smazat celý týden
                </button>
            </section>

            <nav className="day-tabs">
                {SECTION_CODES.map((code) => (
                    <a key={code} href={`#den-${code}`} className={code === today ? 'active' : ''}>
                        {SECTIONS[code]} ({menu.days[code].length})
                    </a>
                ))}
            </nav>

            {SECTION_CODES.map((code) => {
                const items = menu.days[code];
                return (
                    <section key={code} className={`card day${code === today ? ' today' : ''}`} id={`den-${code}`}>
                        <div className="day-head">
                            <h2>{SECTIONS[code]}{code === today && <> <span className="badge">dnes</span></>}</h2>
                            <Link className="btn" to={`/admin/item/new?day=${code}`}>+ Přidat jídlo</Link>
                        </div>
                        {items.length ? (
                            <table className="admin-table">
                                <thead>
                                    <tr><th></th><th>Jídlo</th><th>Kategorie</th><th>Cena</th><th className="actions">Akce</th></tr>
                                </thead>
                                <tbody>{items.map((item, i) => row(code, items, item, i))}</tbody>
                            </table>
                        ) : <p className="empty">Žádná jídla.</p>}
                    </section>
                );
            })}
        </>
    );
}
