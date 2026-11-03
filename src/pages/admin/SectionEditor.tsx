import { useState, type FormEvent } from 'react';
import { DAYS, DAY_CODES, LIMITS, detectWeekday, isDay, type DayCode } from '../../../shared/menu';

type Props = {
    initialTitle?: string;
    initialWeekday?: DayCode | null;
    submitLabel: string;
    busy: boolean;
    onSubmit: (title: string, weekday: DayCode | null) => void;
    onCancel?: () => void;
};

/**
 * Title + "day of the week" picker. While the maintainer hasn't chosen the day by hand,
 * it is guessed from the title ("Pondělí", "Úterý 4. 11.", "streda" …).
 */
export default function SectionEditor({ initialTitle = '', initialWeekday = null, submitLabel, busy, onSubmit, onCancel }: Props) {
    const [title, setTitle] = useState(initialTitle);
    const [weekday, setWeekday] = useState<DayCode | null>(initialWeekday);
    const [manual, setManual] = useState(initialTitle !== '' && detectWeekday(initialTitle) !== initialWeekday);

    function changeTitle(value: string) {
        setTitle(value);
        if (!manual) setWeekday(detectWeekday(value));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        onSubmit(title, weekday);
        if (!onCancel) {
            setTitle('');
            setWeekday(null);
            setManual(false);
        }
    }

    return (
        <form className="row section-editor" onSubmit={submit}>
            <label className="grow">Název sekce
                <input type="text" required maxLength={LIMITS.sectionTitle} value={title} onChange={(e) => changeTitle(e.target.value)}
                    placeholder="např. Pondělí 3. 11., Polévky, Stálá nabídka" />
            </label>
            <label>Den v týdnu
                <select value={weekday ?? ''} onChange={(e) => { setManual(true); setWeekday(isDay(e.target.value) ? e.target.value : null); }}>
                    <option value="">— není den v týdnu —</option>
                    {DAY_CODES.map((code) => <option key={code} value={code}>{DAYS[code]}</option>)}
                </select>
            </label>
            <button type="submit" className="btn" disabled={busy}>{submitLabel}</button>
            {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Zrušit</button>}
        </form>
    );
}
