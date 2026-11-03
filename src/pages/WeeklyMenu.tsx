import DayMenu from '../components/DayMenu';
import { todayCode } from '../../shared/menu';
import { site } from '../../shared/site';
import { useTitle } from '../context';
import { useScrollToHash } from '../router';
import { useActiveMenu } from '../useMenu';

/** The active menu with all its sections (days of the week or anything else). */
export default function WeeklyMenu() {
    const { menu, error } = useActiveMenu();
    useTitle(menu?.name || 'Menu');
    const today = todayCode();
    useScrollToHash(menu !== undefined);
    const hasDays = menu?.sections.some((s) => s.weekday);

    return (
        <>
            <div className="page-banner" role="img" aria-label={`Cedule ${site.name}`} />
            <h1>{menu?.name || 'Menu'}</h1>
            {menu?.note && <p className="week-label">{menu.note}</p>}
            {hasDays && <p className="muted">{site.lunchHours}</p>}
            {site.orderInfo && <p className="order-info">{site.orderInfo}</p>}

            {error && <p className="flash flash-error">{error}</p>}
            {menu === undefined && !error && <p className="muted">Načítám…</p>}
            {menu === null && <p className="empty">Menu zatím není k dispozici.</p>}

            {menu && menu.sections.length > 1 && (
                <nav className="day-tabs">
                    {menu.sections.map((s) => (
                        <a key={s.id} href={`#sekce-${s.id}`} className={s.weekday === today ? 'active' : ''}>{s.title}</a>
                    ))}
                </nav>
            )}

            {menu?.sections.map((s) => (
                <section key={s.id} className={`card day${s.weekday === today ? ' today' : ''}`} id={`sekce-${s.id}`}>
                    <h2>{s.title}{s.weekday === today && <> <span className="badge">dnes</span></>}</h2>
                    <DayMenu items={s.items} emptyText={s.weekday ? 'Pro tento den zatím menu nemáme.' : 'Zatím zde nic není.'} />
                </section>
            ))}
        </>
    );
}
