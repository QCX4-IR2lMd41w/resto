import { useTitle } from '../context';
import { Link } from '../router';

export default function NotFound() {
    useTitle('Stránka nenalezena');
    return (
        <section className="card narrow">
            <h1>Stránka nenalezena</h1>
            <p>Tato stránka neexistuje. <Link to="/">Zpět na úvod</Link></p>
        </section>
    );
}
