import { useEffect, useState, type FormEvent } from 'react';
import { CATEGORIES, FIELD_LIMITS, activeMenu, imageUrl, type MenuItem, type TextField } from '../../../shared/menu';
import { api } from '../../api';
import { useApp, useTitle } from '../../context';
import { Link, navigate } from '../../router';
import { resizeImage } from '../../resizeImage';
import { useStore } from '../../useMenu';
import { useAdminErrorHandler } from './useAdminAction';

type Draft = Omit<MenuItem, 'id'>;
const EMPTY: Draft = { name: '', category: 'Hlavní jídlo', description: '', price: '', weight: '', allergens: '', image: null };

export default function ItemForm({ id }: { id?: string }) {
    const isNew = !id;
    const title = isNew ? 'Nové jídlo' : 'Upravit jídlo';
    useTitle(title);
    const { store, error } = useStore();
    const { setFlashes } = useApp();
    const onError = useAdminErrorHandler();
    const params = new URLSearchParams(location.search);
    const [menuId, setMenuId] = useState(params.get('menu') ?? '');
    const [sectionId, setSectionId] = useState(params.get('section') ?? '');
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [file, setFile] = useState<File | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [busy, setBusy] = useState(false);
    const [missing, setMissing] = useState(false);

    // Edit: load the dish and its menu/section. New: default to the requested (or active) menu.
    useEffect(() => {
        if (!store) return;
        if (id) {
            for (const m of store.menus) {
                for (const s of m.sections) {
                    const item = s.items.find((i) => i.id === id);
                    if (item) {
                        setDraft(item);
                        setMenuId(m.id);
                        setSectionId(s.id);
                        return;
                    }
                }
            }
            setMissing(true);
            return;
        }
        const menu = store.menus.find((m) => m.id === menuId) ?? store.menus.find((m) => m.sections.some((s) => s.id === sectionId)) ?? activeMenu(store) ?? store.menus[0];
        if (!menu) return;
        setMenuId(menu.id);
        if (!menu.sections.some((s) => s.id === sectionId)) setSectionId(menu.sections[0]?.id ?? '');
    }, [store, id]); // menuId/sectionId are only the initial choice from the URL

    const menu = store?.menus.find((m) => m.id === menuId);
    const set = (field: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [field]: e.target.value }));
    const back = `/admin?menu=${menuId}${sectionId ? `#sekce-${sectionId}` : ''}`;

    async function submit(e: FormEvent) {
        e.preventDefault();
        setFlashes([]);
        setBusy(true);
        try {
            const data = new FormData();
            data.set('section', sectionId);
            data.set('category', draft.category);
            for (const f of Object.keys(FIELD_LIMITS) as TextField[]) data.set(f, draft[f]);
            if (removeImage) data.set('remove_image', '1');
            if (file) data.set('image', await resizeImage(file));
            const result = id ? await api.updateItem(id, data) : await api.createItem(data);
            navigate(back, { flash: ['ok', result.message ?? 'Uloženo.'] });
        } catch (err) {
            onError(err);
            setBusy(false);
        }
    }

    if (error) return <p className="flash flash-error">{error}</p>;
    if (missing) return <p className="flash flash-error">Položka nenalezena. <Link to="/admin">Zpět na správu menu</Link></p>;
    if (!store) return <p className="muted">Načítám…</p>;
    if (!menu || !menu.sections.length) {
        return <p className="flash flash-error">Menu nemá žádnou sekci – nejdřív ji přidejte. <Link to={`/admin?menu=${menuId}`}>Zpět na správu menu</Link></p>;
    }

    const img = imageUrl(draft.image);
    const text = (name: TextField, label: string, placeholder = '') => (
        <label className="grow">{label}
            <input type="text" maxLength={FIELD_LIMITS[name]} value={draft[name]} onChange={set(name)} placeholder={placeholder} />
        </label>
    );

    return (
        <section className="card narrow">
            <h1>{title}</h1>
            <p className="muted">Menu: <strong>{menu.name}</strong></p>
            <form className="form" onSubmit={submit}>
                <div className="row">
                    <label className="grow">Sekce
                        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                            {menu.sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                    </label>
                    <label className="grow">Kategorie
                        <select value={draft.category} onChange={set('category')}>
                            {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                        </select>
                    </label>
                </div>
                <label>Název jídla *
                    <input type="text" required maxLength={FIELD_LIMITS.name} value={draft.name} onChange={set('name')} />
                </label>
                <label>Popis
                    <textarea rows={3} maxLength={FIELD_LIMITS.description} value={draft.description} onChange={set('description')} />
                </label>
                <div className="row">
                    {text('weight', 'Gramáž / objem', '150 g')}
                    {text('price', 'Cena', '159 Kč')}
                    {text('allergens', 'Alergeny', '1, 3, 7')}
                </div>
                {img && (
                    <div className="current-image">
                        <img src={img} alt="" />
                        <label className="checkbox">
                            <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} /> Odstranit obrázek
                        </label>
                    </div>
                )}
                <label>{img ? 'Nahradit obrázek' : 'Obrázek (nepovinný)'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <span className="muted small">JPG, PNG, WEBP nebo GIF. Velké fotky se před nahráním automaticky zmenší.</span>
                </label>
                <div className="row">
                    <button type="submit" className="btn" disabled={busy || !sectionId}>{busy ? 'Ukládám…' : isNew ? 'Přidat jídlo' : 'Uložit změny'}</button>
                    <Link className="btn btn-secondary" to={back}>Zpět</Link>
                </div>
            </form>
        </section>
    );
}
