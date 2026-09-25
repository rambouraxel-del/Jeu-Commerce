import { useState } from 'react';
import { CATEGORY_MAP } from '../../data/categories';
import { FURNITURE_MAP } from '../../data/furniture';
import { PRODUCTS, PRODUCT_MAP } from '../../data/products';
import { SUPPLIER_MAP } from '../../data/suppliers';
import { marginRate, perceivedRatio, priceAttractiveness, priceLabel, roundPrice } from '../../game/economy/pricing';
import { effectivePrice, productDiscount } from '../../game/marketing/marketing';
import { isProductUnlocked } from '../../game/state';
import { averageSales, canHold, shelfCapacity, shelfStock, slotCapacity, stockStatus } from '../../game/store/stock';
import { availableSuppliers, supplierCatalog, supplierUnitCost } from '../../game/suppliers/orders';
import { euros, pct } from '../../utils/format';
import { Badge, Modal, Progress, Sheet } from '../components/common';
import { useController } from '../hooks';
import { STATUS_LABEL } from './StockPanel';

export function qualityStars(q: number): string {
  const n = Math.max(1, Math.min(5, Math.round(q / 20)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function ProductSheet() {
  const c = useController();
  const pid = c.productSheet;
  if (!pid) return null;
  const s = c.engine.state;
  const def = PRODUCT_MAP[pid];
  const ps = s.products[pid];
  const close = () => {
    c.productSheet = null;
    c.bump();
  };
  const eff = effectivePrice(s, pid);
  const ratio = ps.price / def.marketPrice;
  const label = priceLabel(ratio);
  const attract = priceAttractiveness(perceivedRatio(ps.price, def.marketPrice, ps.avgQuality, 1), 1);
  const st = stockStatus(s, pid);
  const discount = productDiscount(s, pid);
  const setPrice = (v: number) => c.result(c.engine.setPrice(pid, Math.max(1, Math.round(v))));
  const suppliers = availableSuppliers(s).filter((sup) => supplierCatalog(s, sup.id).includes(pid));
  const holders = s.furniture.filter((f) => f.slots.some((sl) => sl.productId === pid));

  return (
    <Sheet title={<>{def.icon} {def.name}</>} onClose={close}>
      <div className="kv-line">
        <span>{CATEGORY_MAP[def.category].icon} {CATEGORY_MAP[def.category].name}</span>
        <Badge tone={STATUS_LABEL[st].tone}>{STATUS_LABEL[st].text}</Badge>
      </div>

      <section className="card">
        <h3>Prix de vente</h3>
        <div className="price-big">
          {euros(ps.price, 2)}
          {discount > 0 && <span className="promo-tag">promo : {euros(eff, 2)}</span>}
        </div>
        <div className={`perception ${label.tone}`}>
          {label.text} · {pct(ratio)} du prix du marché ({euros(def.marketPrice, 2)})
        </div>
        <input
          type="range"
          min={Math.round(def.marketPrice * 0.5)}
          max={Math.round(def.marketPrice * 2.2)}
          step={Math.max(1, Math.round(def.marketPrice / 100))}
          value={ps.price}
          onChange={(e) => setPrice(Number(e.target.value))}
          aria-label="Prix"
          className="slider"
        />
        <div className="btn-row">
          <button className="btn" onClick={() => setPrice(ps.price * 0.95)}>−5 %</button>
          <button className="btn" onClick={() => setPrice(ps.price - 1)}>−1 c</button>
          <button className="btn" onClick={() => setPrice(roundPrice(def.marketPrice))}>= Marché</button>
          <button className="btn" onClick={() => setPrice(ps.price + 1)}>+1 c</button>
          <button className="btn" onClick={() => setPrice(ps.price * 1.05)}>+5 %</button>
        </div>
        <div className="kv-grid">
          <span>Coût moyen</span>
          <b>{euros(ps.avgCost, 2)}</b>
          <span>Marge unitaire</span>
          <b className={eff - ps.avgCost < 0 ? 'neg' : ''}>
            {euros(eff - ps.avgCost, 2)} ({pct(marginRate(eff, ps.avgCost))})
          </b>
          <span>Attractivité prix</span>
          <b>{pct(attract)} <small>(100 % = prix marché)</small></b>
          <span>Qualité</span>
          <b>
            {qualityStars(ps.avgQuality)} ({Math.round(ps.avgQuality)})
          </b>
        </div>
      </section>

      <section className="card">
        <h3>Stock & ventes</h3>
        <div className="kv-grid">
          <span>En rayon</span>
          <b>
            {shelfStock(s, pid)} / {shelfCapacity(s, pid)}
          </b>
          <span>En réserve</span>
          <b>{ps.reserve}</b>
          <span>Ventes moyennes</span>
          <b>{averageSales(ps).toFixed(1).replace('.', ',')} / jour</b>
          <span>Vendus aujourd’hui</span>
          <b>{ps.soldToday}</b>
          <span>Total vendus</span>
          <b>{ps.soldTotal}</b>
          <span>Popularité</span>
          <b>{pct(ps.popularity)}</b>
        </div>
        {holders.length === 0 && (
          <button
            className="btn wide"
            onClick={() => {
              const f = s.furniture.find((x) => canHold(x, pid) && x.slots.some((sl) => sl.productId === null));
              if (!f) return c.toast('Aucun emplacement libre compatible : installez un rayon adapté.', 'bad');
              c.result(c.engine.assignSlot(f.uid, f.slots.findIndex((sl) => sl.productId === null), pid), 'Produit placé en rayon');
            }}
          >
            🏷️ Placer ce produit dans un rayon libre
          </button>
        )}
      </section>

      <section className="card">
        <h3>Promotion sur ce produit</h3>
        <div className="btn-row">
          {[0.1, 0.2, 0.3].map((d) => (
            <button key={d} className="btn" onClick={() => c.result(c.engine.createPromotion('product', pid, d, 3), `Promo −${d * 100} % pendant 3 jours`)}>
              −{d * 100} % (3 j)
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Commander</h3>
        {suppliers.length === 0 && <p className="hint">Aucun fournisseur disponible pour ce produit.</p>}
        {suppliers.map((sup) => (
          <div key={sup.id} className="kv-line">
            <span>
              {sup.icon} {sup.name} · {euros(supplierUnitCost(s, sup.id, pid), 2)} · Q {qualityStars(sup.quality)}
            </span>
            <button
              className="btn small"
              onClick={() => {
                c.orderDraft = { supplierId: sup.id, lines: { [pid]: Math.max(6, shelfCapacity(s, pid) - shelfStock(s, pid)) } };
                c.computerTab = 'suppliers';
                c.productSheet = null;
                c.setTab('computer');
              }}
            >
              Commander
            </button>
          </div>
        ))}
      </section>
    </Sheet>
  );
}

export function ShelfSheet() {
  const c = useController();
  const uid = c.shelfSheet;
  const [picking, setPicking] = useState<number | null>(null);
  if (!uid) return null;
  const s = c.engine.state;
  const f = c.engine.furnitureByUid(uid);
  if (!f) return null;
  const def = FURNITURE_MAP[f.defId];
  const close = () => {
    c.shelfSheet = null;
    c.bump();
  };
  return (
    <>
      <Sheet title={<>{def.icon} {def.name}</>} onClose={close}>
        <p className="hint">
          Accepte : {def.categories?.filter((x) => s.unlockedCategories.includes(x)).map((x) => CATEGORY_MAP[x].name).join(', ')}
          {def.appeal ? ` · Attractivité +${Math.round(def.appeal * 100)} %` : ''}
        </p>
        <div className="list">
          {f.slots.map((sl, i) => {
            const prod = sl.productId ? PRODUCT_MAP[sl.productId] : null;
            const cap = sl.productId ? slotCapacity(s, f, sl.productId) : 0;
            return (
              <div key={i} className="slot-row">
                <div className="slot-main">
                  <span className="row-icon">{prod ? prod.icon : '▫️'}</span>
                  <div className="slot-info">
                    <div className="row-name">{prod ? prod.name : `Emplacement ${i + 1} libre`}</div>
                    {prod && (
                      <>
                        <Progress value={cap ? sl.qty / cap : 0} tone={sl.qty === 0 ? '#d62828' : sl.qty < cap * 0.25 ? '#f4a261' : '#2b9348'} />
                        <div className="slot-sub">
                          {sl.qty}/{cap} · {euros(effectivePrice(s, prod.id), 2)} · réserve {s.products[prod.id].reserve}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="slot-actions">
                  <button className="btn small" onClick={() => setPicking(i)}>
                    {prod ? 'Changer' : 'Choisir'}
                  </button>
                  {prod && (
                    <>
                      <button
                        className="btn small"
                        onClick={() => {
                          c.productSheet = prod.id;
                          c.shelfSheet = null;
                          c.bump();
                        }}
                      >
                        Prix
                      </button>
                      <button className="btn small" onClick={() => c.result(c.engine.assignSlot(uid, i, null))}>
                        Vider
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              c.shelfSheet = null;
              c.enterBuild();
              c.build.selectedUid = uid;
              c.startMove(uid);
            }}
          >
            ✥ Déplacer
          </button>
          <button className="btn danger" onClick={() => c.sellFurniture(uid)}>
            💰 Revendre
          </button>
        </div>
      </Sheet>
      {picking !== null && (
        <Modal title="Choisir un produit" onClose={() => setPicking(null)}>
          <div className="list">
            {PRODUCTS.filter((p) => isProductUnlocked(s, p.id) && canHold(f, p.id)).map((p) => {
              const ps = s.products[p.id];
              const onShelf = shelfStock(s, p.id);
              return (
                <button
                  key={p.id}
                  className="row-card compact"
                  onClick={() => {
                    c.result(c.engine.assignSlot(uid, picking, p.id));
                    setPicking(null);
                  }}
                >
                  <span className="row-icon">{p.icon}</span>
                  <span className="row-name">{p.name}</span>
                  <span className="row-meta">
                    réserve {ps.reserve} · rayon {onShelf} · {euros(ps.price, 2)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="hint">Les produits en réserve sont immédiatement placés dans l’emplacement choisi.</p>
        </Modal>
      )}
    </>
  );
}

export function supplierName(id: string | null): string {
  return id ? SUPPLIER_MAP[id]?.name ?? id : '—';
}
