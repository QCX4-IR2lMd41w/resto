import DayMenu from '../components/DayMenu';
import { DAYS, SECTIONS, todayCode, todayDate } from '../../shared/menu';
import { site } from '../../shared/site';
import { useTitle } from '../context';
import { Link, useScrollToHash } from '../router';
import { useMenu } from '../useMenu';

export default function Home() {
    useTitle('Úvod');
    const { menu, error } = useMenu();
    const today = todayCode();
    useScrollToHash(menu !== null);
    const permanent = menu?.days.stala ?? [];

    return (
        <>
            <section className="hero">
                <h1>{site.name}</h1>
                <p className="tagline">{site.tagline}</p>
                <Link className="btn" to="/menu">Celé týdenní menu</Link>
            </section>

            <section className="card">
                <h2>Dnešní menu <span className="muted">&ndash; {DAYS[today]} {todayDate()}</span></h2>
                <p className="muted">{site.lunchHours}</p>
                {error ? <p className="flash flash-error">{error}</p> : menu ? <DayMenu items={menu.days[today]} /> : <p className="muted">Načítám…</p>}
                {site.orderInfo && <p className="order-info">{site.orderInfo}</p>}
            </section>

            {permanent.length > 0 && (
                <section className="card">
                    <h2>{SECTIONS.stala}</h2>
                    <DayMenu items={permanent} />
                </section>
            )}

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
