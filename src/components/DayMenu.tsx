import { CATEGORIES, imageUrl, type MenuItem } from '../../shared/menu';

function Dish({ item }: { item: MenuItem }) {
    const img = imageUrl(item.image);
    return (
        <article className={`dish${img ? ' has-img' : ''}`}>
            {img && <img src={img} alt={item.name} loading="lazy" />}
            <div className="dish-body">
                <div className="dish-head">
                    <h4>
                        {item.weight && <span className="weight">{item.weight}</span>} {item.name}
                    </h4>
                    {item.price && <span className="price">{item.price}</span>}
                </div>
                {item.description && <p className="pre-line">{item.description}</p>}
                {item.allergens && <p className="allergens">Alergeny: {item.allergens}</p>}
            </div>
        </article>
    );
}

export default function DayMenu({ items }: { items: MenuItem[] }) {
    if (!items.length) return <p className="empty">Pro tento den zatím menu nemáme.</p>;
    return CATEGORIES.map((cat) => {
        const group = items.filter((i) => (i.category ?? 'Ostatní') === cat);
        return group.length ? (
            <div key={cat}>
                <h3 className="category">{cat}</h3>
                <div className="dishes">
                    {group.map((item) => <Dish key={item.id} item={item} />)}
                </div>
            </div>
        ) : null;
    });
}
