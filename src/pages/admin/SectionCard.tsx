import { useState, type FormEvent } from 'react';
import { DAYS, imageUrl, todayCode, type MenuItem, type MenuStore, type Section } from '../../../shared/menu';
import { api, type StoreResult } from '../../api';
import { Link } from '../../router';
import SectionEditor from './SectionEditor';

const truncate = (s: string, n: number) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);

type Props = {
    store: MenuStore;
    menuId: string;
    section: Section;
    index: number;
    count: number;
    busy: boolean;
    run: (action: () => Promise<StoreResult>, confirmText?: string) => Promise<boolean>;
};

export default function SectionCard({ store, menuId, section, index, count, busy, run }: Props) {
    const [editing, setEditing] = useState(false);
    const today = section.weekday === todayCode();
    const items = section.items;

    const row = (item: MenuItem, i: number) => {
        const img = imageUrl(item.image);
        const copy = (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const target = String(new FormData(e.currentTarget).get('target'));
            run(() => api.copyItem(item.id, target));
        };
        return (
            <tr key={item.id}>
                <td className="thumb">{img && <img src={img} alt="" />}</td>
                <td>
                    <strong>{item.name}</strong>
                    {item.description && <><br /><span className="muted small">{truncate(item.description, 90)}</span></>}
                </td>
                <td>{item.category || <span className="muted">bez kategorie</span>}</td>
                <td className="nowrap">{item.price}</td>
                <td className="actions">
                    <button type="button" className="btn-icon" title="Posunout nahoru" disabled={busy || i === 0}
                        onClick={() => run(() => api.moveItem(item.id, 'up'))}>&uarr;</button>
                    <button type="button" className="btn-icon" title="Posunout dolů" disabled={busy || i === items.length - 1}
                        onClick={() => run(() => api.moveItem(item.id, 'down'))}>&darr;</button>
                    <Link className="btn btn-small" to={`/admin/item/${item.id}`}>Upravit</Link>
                    <form className="inline copy-form" onSubmit={copy}>
                        <select name="target" aria-label="Kopírovat do sekce">
                            {store.menus.map((m) => (
                                <optgroup key={m.id} label={m.name}>
                                    {m.sections.filter((s) => s.id !== section.id).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                                </optgroup>
                            ))}
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
        <section className={`card day${today ? ' today' : ''}`} id={`sekce-${section.id}`}>
            {editing ? (
                <SectionEditor initialTitle={section.title} initialWeekday={section.weekday} submitLabel="Uložit sekci" busy={busy}
                    onCancel={() => setEditing(false)}
                    onSubmit={async (title, weekday) => {
                        if (await run(() => api.updateSection(section.id, { title, weekday }))) setEditing(false);
                    }} />
            ) : (
                <div className="day-head">
                    <h2>
                        {section.title}
                        {today && <> <span className="badge">dnes</span></>}
                        {section.weekday && !today && section.title !== DAYS[section.weekday] && <> <span className="badge badge-muted">{DAYS[section.weekday]}</span></>}
                    </h2>
                    <div className="actions">
                        <button type="button" className="btn-icon" title="Sekci výš" disabled={busy || index === 0}
                            onClick={() => run(() => api.moveSection(section.id, 'up'))}>&uarr;</button>
                        <button type="button" className="btn-icon" title="Sekci níž" disabled={busy || index === count - 1}
                            onClick={() => run(() => api.moveSection(section.id, 'down'))}>&darr;</button>
                        <button type="button" className="btn btn-small btn-secondary" onClick={() => setEditing(true)}>Přejmenovat</button>
                        <button type="button" className="btn btn-small btn-danger" disabled={busy}
                            onClick={() => run(() => api.deleteSection(section.id), `Smazat sekci „${section.title}“ včetně všech jejích jídel?`)}>
                            Smazat sekci
                        </button>
                        <Link className="btn btn-small" to={`/admin/item/new?section=${section.id}&menu=${menuId}`}>+ Přidat jídlo</Link>
                    </div>
                </div>
            )}
            {items.length ? (
                <table className="admin-table">
                    <thead>
                        <tr><th></th><th>Jídlo</th><th>Kategorie</th><th>Cena</th><th className="actions">Akce</th></tr>
                    </thead>
                    <tbody>{items.map(row)}</tbody>
                </table>
            ) : <p className="empty">Žádná jídla.</p>}
        </section>
    );
}
