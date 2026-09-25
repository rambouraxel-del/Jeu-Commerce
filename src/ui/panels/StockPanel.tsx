import { useMemo, useState } from 'react';
import { CATEGORY_MAP } from '../../data/categories';
import { PRODUCTS } from '../../data/products';
import { SUPPLIER_MAP } from '../../data/suppliers';
import { marginRate } from '../../game/economy/pricing';
import { effectivePrice, productDiscount } from '../../game/marketing/marketing';
import { isProductUnlocked } from '../../game/state';
import { averageSales, reserveCapacity, reserveUsed, shelfCapacity, shelfStock, stockStatus, type StockStatus } from '../../game/store/stock';
import type { CategoryId } from '../../game/types';
import { euros, pct } from '../../utils/format';
import { Badge, Empty } from '../components/common';
import { useController } from '../hooks';

export const STATUS_LABEL: Record<StockStatus, { text: string; tone: 'good' | 'bad' | 'warn' | 'neutral' | 'info' }> = {
  ok: { text: 'OK', tone: 'good' },
  low: { text: 'Faible', tone: 'warn' },
  out: { text: 'Rupture', tone: 'bad' },
  over: { text: 'Surstock', tone: 'info' },
  none: { text: 'Non proposé', tone: 'neutral' },
};

type SortKey = 'name' | 'stock' | 'sales' | 'margin' | 'category';

export function StockPanel() {
  const c = useController();
  const s = c.engine.state;
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [status, setStatus] = useState<StockStatus | 'all' | 'reserve'>('all');
  const [sort, setSort] = useState<SortKey>('category');
  const [mine, setMine] = useState(true);

  const rows = useMemo(() => {
    return PRODUCTS.filter((p) => isProductUnlocked(s, p.id)).map((p) => {
      const ps = s.products[p.id];
      const shelf = shelfStock(s, p.id);
      const cap = shelfCapacity(s, p.id);
      const st = stockStatus(s, p.id);
      return {
        p,
        ps,
        shelf,
        cap,
        st,
        avg: averageSales(ps),
        eff: effectivePrice(s, p.id),
        margin: marginRate(effectivePrice(s, p.id), ps.avgCost),
        promo: productDiscount(s, p.id),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.version]);

  const filtered = rows
    .filter((r) => cat === 'all' || r.p.category === cat)
    .filter((r) => !mine || r.cap > 0 || r.shelf + r.ps.reserve > 0)
    .filter((r) => (status === 'all' ? true : status === 'reserve' ? r.ps.reserve > 0 : r.st === status))
    .sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.p.name.localeCompare(b.p.name);
        case 'stock':
          return a.shelf + a.ps.reserve - (b.shelf + b.ps.reserve);
        case 'sales':
          return b.avg - a.avg;
        case 'margin':
          return b.margin - a.margin;
        default:
          return a.p.category.localeCompare(b.p.category) || a.p.name.localeCompare(b.p.name);
      }
    });

  const counts = rows.reduce(
    (acc, r) => {
      if (r.cap > 0 || r.shelf + r.ps.reserve > 0) acc[r.st] = (acc[r.st] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<StockStatus, number>>,
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>📦 Stock</h2>
        <div className="panel-sub">
          Réserve : {reserveUsed(s)} / {reserveCapacity(s)} unités · Ruptures : {counts.out ?? 0} · Faibles : {counts.low ?? 0}
        </div>
      </div>
      <div className="filters">
        <select value={cat} onChange={(e) => setCat(e.target.value as any)} aria-label="Catégorie">
          <option value="all">Toutes catégories</option>
          {s.unlockedCategories.map((id) => (
            <option key={id} value={id}>
              {CATEGORY_MAP[id].icon} {CATEGORY_MAP[id].name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Tri">
          <option value="category">Tri : catégorie</option>
          <option value="name">Tri : nom</option>
          <option value="stock">Tri : stock</option>
          <option value="sales">Tri : ventes</option>
          <option value="margin">Tri : marge</option>
        </select>
      </div>
      <div className="chips">
        {(['all', 'ok', 'low', 'out', 'over', 'reserve'] as const).map((k) => (
          <button key={k} className={`chip ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>
            {k === 'all' ? 'Tous' : k === 'reserve' ? 'En réserve' : STATUS_LABEL[k].text}
          </button>
        ))}
        <label className="chip toggle">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mes produits
        </label>
      </div>
      {filtered.length === 0 ? (
        <Empty icon="🛒">
          {mine ? 'Aucun produit proposé. Installez un rayon et commandez des produits via l’ordinateur.' : 'Aucun produit ne correspond.'}
        </Empty>
      ) : (
        <div className="list">
          {filtered.map((r) => (
            <button key={r.p.id} className="row-card" onClick={() => { c.productSheet = r.p.id; c.bump(); }}>
              <div className="row-top">
                <span className="row-icon">{r.p.icon}</span>
                <span className="row-name">
                  {r.p.name}
                  {r.promo > 0 && <span className="promo-tag">−{Math.round(r.promo * 100)} %</span>}
                </span>
                <Badge tone={STATUS_LABEL[r.st].tone}>{STATUS_LABEL[r.st].text}</Badge>
              </div>
              <div className="row-grid">
                <span>
                  Rayon <b>{r.shelf}</b>/{r.cap}
                </span>
                <span>
                  Réserve <b>{r.ps.reserve}</b>
                </span>
                <span>
                  Ventes <b>{r.avg.toFixed(1).replace('.', ',')}</b>/j
                </span>
                <span>
                  Achat <b>{euros(r.ps.avgCost)}</b>
                </span>
                <span>
                  Prix <b>{euros(r.eff)}</b>
                </span>
                <span>
                  Marché {euros(r.p.marketPrice)}
                </span>
                <span className={r.margin < 0.15 ? 'neg' : ''}>
                  Marge <b>{pct(r.margin)}</b>
                </span>
                <span>
                  Auj. <b>{r.ps.soldToday}</b> · Q {Math.round(r.ps.avgQuality)}
                </span>
                <span className="ellipsis">{r.ps.lastSupplier ? SUPPLIER_MAP[r.ps.lastSupplier].name : '—'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="hint">Touchez un produit pour modifier son prix, lancer une promotion ou le commander.</p>
    </div>
  );
}
