import DayMenu from '../components/DayMenu';
import { DAYS, todayCode, todayDate } from '../../shared/menu';
import { site } from '../../shared/site';
import { useTitle } from '../context';
import { Link, useScrollToHash } from '../router';
import { useActiveMenu } from '../useMenu';

export default function Home() {
    useTitle('Úvod');
    const { menu, error } = useActiveMenu();
    const today = todayCode();
    useScrollToHash(menu !== undefined);

    const sections = menu?.sections ?? [];
    const hasDays = sections.some((s) => s.weekday);
    const todays = sections.filter((s) => s.weekday === today);
    // Weekly menus: today's day + sections without a weekday (e.g. "Stálá nabídka"). Other menus: all sections.
    const others = hasDays ? sections.filter((s) => !s.weekday) : sections;

    return (
        <>
            <section className="hero">
                <h1>{site.name}</h1>
                <p className="tagline">{site.tagline}</p>
                <Link className="btn" to="/menu">Celé menu</Link>
            </section>

            {error && <p className="flash flash-error">{error}</p>}
            {menu === undefined && !error && <p className="muted">Načítám…</p>}
            {menu === null && <section className="card"><p className="empty">Menu zatím není k dispozici.</p></section>}

            {menu && hasDays && (
                <section className="card">
                    <h2>Dnešní menu <span className="muted">&ndash; {DAYS[today]} {todayDate()}</span></h2>
                    <p className="muted">{site.lunchHours}</p>
                    {todays.length === 0 && <p className="empty">Dnes polední menu nepodáváme.</p>}
                    {todays.map((s) => (
                        <div key={s.id}>
                            {(todays.length > 1 || s.title !== DAYS[today]) && <h3 className="section-subtitle">{s.title}</h3>}
                            <DayMenu items={s.items} emptyText="Pro dnešek zatím menu nemáme." />
                        </div>
                    ))}
                    {site.orderInfo && <p className="order-info">{site.orderInfo}</p>}
                </section>
            )}

            {menu && !hasDays && (menu.name || menu.note) && (
                <div className="menu-head">
                    <h2>{menu.name}</h2>
                    {menu.note && <p className="week-label">{menu.note}</p>}
                </div>
            )}

            {others.map((s) => (
                <section key={s.id} className="card">
                    <h2>{s.title}</h2>
                    <DayMenu items={s.items} />
                </section>
            ))}

            <div className="grid-2">
                <section className="card about">
                    <img className="card-photo about-photo" src="/images/vycep.jpg" alt="Čepování piva u výčepu" width={542} height={720} loading="lazy" />
                    <h2>O nás</h2>
                    <p>{site.about}</p>
                </section>
                <section className="card" id="kontakt">
                    <img className="card-photo" src="/images/cedule.jpg" alt={`Cedule ${site.name}`} width={1200} height={800} loading="lazy" />
                    <h2>Otevírací doba</h2>
                    <table className="hours">
                        <tbody>
                            {Object.entries(site.hours).map(([days, time]) => (
                                <tr key={days}><th>{days}</th><td>{time}</td></tr>
                            ))}
                        </tbody>
                    </table>
                    <h2>Kontakt</h2>
                    <p>
                        {site.address}<br />
                        Tel.: <a href={`tel:${site.phone.replace(/\s+/g, '')}`}>{site.phone}</a><br />
                        E-mail: <a href={`mailto:${site.email}`}>{site.email}</a>
                    </p>
                </section>
            </div>
        </>
    );
}
