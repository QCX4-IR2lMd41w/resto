import DayMenu from '../components/DayMenu';
import { SECTIONS, SECTION_CODES, todayCode } from '../../shared/menu';
import { site } from '../../shared/site';
import { useTitle } from '../context';
import { useScrollToHash } from '../router';
import { useMenu } from '../useMenu';

export default function WeeklyMenu() {
    useTitle('Týdenní menu');
    const { menu, error } = useMenu();
    const today = todayCode();
    useScrollToHash(menu !== null);

    return (
        <>
            <div className="page-banner" role="img" aria-label={`Cedule ${site.name}`} />
            <h1>Týdenní menu</h1>
            {menu?.week_label && <p className="week-label">{menu.week_label}</p>}
            <p className="muted">{site.lunchHours}</p>
            {site.orderInfo && <p className="order-info">{site.orderInfo}</p>}

            <nav className="day-tabs">
                {SECTION_CODES.map((code) => (
                    <a key={code} href={`#den-${code}`} className={code === today ? 'active' : ''}>{SECTIONS[code]}</a>
                ))}
            </nav>

            {error && <p className="flash flash-error">{error}</p>}
            {!menu && !error && <p className="muted">Načítám…</p>}
            {menu && SECTION_CODES.map((code) => (
                <section key={code} className={`card day${code === today ? ' today' : ''}`} id={`den-${code}`}>
                    <h2>{SECTIONS[code]}{code === today && <> <span className="badge">dnes</span></>}</h2>
                    <DayMenu items={menu.days[code]} />
                </section>
            ))}
        </>
    );
}
