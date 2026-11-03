import { useEffect, useState, type FormEvent } from 'react';
import {
    CATEGORIES, FIELD_LIMITS, SECTIONS, SECTION_CODES, imageUrl, isSection, todayCode,
    type MenuItem, type SectionCode, type TextField,
} from '../../../shared/menu';
import { api } from '../../api';
import { useApp, useTitle } from '../../context';
import { Link, navigate } from '../../router';
import { resizeImage } from '../../resizeImage';
import { useMenu } from '../../useMenu';
import { useAdminErrorHandler } from './useAdminAction';

type Draft = Omit<MenuItem, 'id'>;
const EMPTY: Draft = { name: '', category: 'Hlavní jídlo', description: '', price: '', weight: '', allergens: '', image: null };

export default function ItemForm({ id }: { id?: string }) {
    const isNew = !id;
    const title = isNew ? 'Nové jídlo' : 'Upravit jídlo';
    useTitle(title);
    const { menu, error } = useMenu();
    const { setFlashes } = useApp();
    const onError = useAdminErrorHandler();
    const queryDay = new URLSearchParams(location.search).get('day');
    const [day, setDay] = useState<SectionCode>(isSection(queryDay) ? queryDay : todayCode());
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [file, setFile] = useState<File | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [busy, setBusy] = useState(false);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        if (!menu || !id) return;
        for (const code of SECTION_CODES) {
            const item = menu.days[code].find((i) => i.id === id);
            if (item) {
                setDraft(item);
                setDay(code);
                return;
            }
        }
        setMissing(true);
    }, [menu, id]);

    const set = (field: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [field]: e.target.value }));

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            const data = new FormData();
            data.set('day', day);
            data.set('category', draft.category);
            for (const f of Object.keys(FIELD_LIMITS) as TextField[]) data.set(f, draft[f]);
            if (removeImage) data.set('remove_image', '1');
            if (file) data.set('image', await resizeImage(file));
            const result = id ? await api.updateItem(id, data) : await api.createItem(data);
            navigate(`/admin#den-${day}`, { flash: ['ok', result.message ?? 'Uloženo.'] });
        } catch (err) {
            onError(err);
            setBusy(false);
        }
    }

    if (error) return <p className="flash flash-error">{error}</p>;
    if (missing) return <p className="flash flash-error">Položka nenalezena. <Link to="/admin">Zpět na správu menu</Link></p>;
    if (!isNew && !menu) return <p className="muted">Načítám…</p>;

    const img = imageUrl(draft.image);
    const text = (name: TextField, label: string, placeholder = '') => (
        <label className="grow">{label}
            <input type="text" maxLength={FIELD_LIMITS[name]} value={draft[name]} onChange={set(name)} placeholder={placeholder} />
        </label>
    );

    return (
        <section className="card narrow">
            <h1>{title}</h1>
            <form className="form" onSubmit={(e) => { setFlashes([]); submit(e); }}>
                <div className="row">
                    <label className="grow">Den / sekce
                        <select value={day} onChange={(e) => setDay(e.target.value as SectionCode)} required>
                            {SECTION_CODES.map((code) => <option key={code} value={code}>{SECTIONS[code]}</option>)}
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
                    <button type="submit" className="btn" disabled={busy}>{busy ? 'Ukládám…' : isNew ? 'Přidat jídlo' : 'Uložit změny'}</button>
                    <Link className="btn btn-secondary" to={`/admin#den-${day}`}>Zpět</Link>
                </div>
            </form>
        </section>
    );
}
