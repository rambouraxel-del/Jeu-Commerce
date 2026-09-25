import { useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_MAP } from '../../data/categories';
import { CAMPAIGNS } from '../../data/marketing';
import { MONTH_NAMES } from '../../data/calendar';
import { SEGMENT_MAP } from '../../data/customers';
import { PRODUCTS, PRODUCT_MAP } from '../../data/products';
import { SUPPLIERS, SUPPLIER_MAP } from '../../data/suppliers';
import { dateInfo } from '../../game/calendar/calendar';
import { promotionLabel } from '../../game/marketing/marketing';
import { isProductUnlocked } from '../../game/state';
import { averageSales, shelfCapacity, shelfStock } from '../../game/store/stock';
import {
  delayLabel,
  isSupplierUnlocked,
  supplierCatalog,
  supplierPriceFactor,
  supplierQuality,
  supplierUnitCost,
  suggestOrder,
} from '../../game/suppliers/orders';
import type { CategoryId, DayRecord, MarketReport, PromoScope } from '../../game/types';
import { clock, compactEuros, euros, pct } from '../../utils/format';
import { LineChart, ShareBar } from '../components/charts';
import { Badge, Empty, Stepper, Tabs } from '../components/common';
import { useController } from '../hooks';
import { DayReportView } from './Modals';
import { qualityStars } from './Sheets';

type CTab = 'suppliers' | 'orders' | 'marketing' | 'reports' | 'market' | 'catalog';

export function ComputerPanel() {
  const c = useController();
  const tab = c.computerTab as CTab;
  const arrived = c.engine.state.orders.filter((o) => o.status === 'arrived').length;
  return (
    <div className="panel computer">
      <div className="os-window">
        <div className="os-titlebar">
          <span className="os-dots">
            <i />
            <i />
            <i />
          </span>
          <span>CommerceOS — {c.engine.state.customization.storeName}</span>
        </div>
        <Tabs
          className="os-tabs"
          value={tab}
          onChange={(v) => {
            c.computerTab = v;
            c.bump();
          }}
          options={[
            { id: 'suppliers', label: '🚚 Fournisseurs' },
            { id: 'orders', label: <>📋 Commandes{arrived ? <span className="nav-dot inline">{arrived}</span> : null}</> },
            { id: 'marketing', label: '📣 Marketing' },
            { id: 'reports', label: '🧾 Rapports' },
            { id: 'market', label: '📈 Marché' },
            { id: 'catalog', label: '📚 Catalogue' },
          ]}
        />
        <div className="os-content">
          {tab === 'suppliers' && <SuppliersTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'marketing' && <MarketingTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'market' && <MarketTab />}
          {tab === 'catalog' && <CatalogTab />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Fournisseurs

function SuppliersTab() {
  const c = useController();
  const s = c.engine.state;
  const [selected, setSelected] = useState<string | null>(c.orderDraft?.supplierId ?? null);
  useEffect(() => {
    if (c.orderDraft) setSelected(c.orderDraft.supplierId);
  }, [c.orderDraft]);
  if (selected) return <SupplierCatalog supplierId={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="list">
      <p className="hint">Choisissez un fournisseur pour consulter son catalogue et commander. Moins cher ne veut pas dire meilleur : la qualité influence la satisfaction.</p>
      {SUPPLIERS.map((sup) => {
        const unlocked = isSupplierUnlocked(s, sup);
        const f = supplierPriceFactor(s, sup.id);
        return (
          <button key={sup.id} className={`supplier-card ${unlocked ? '' : 'locked'}`} disabled={!unlocked} onClick={() => setSelected(sup.id)} data-testid={`sup-${sup.id}`}>
            <div className="sup-head">
              <span className="sup-icon" style={{ background: sup.truckColor }}>
                {unlocked ? sup.icon : '🔒'}
              </span>
              <div>
                <div className="row-name">{sup.name}</div>
                <div className="sup-desc">{unlocked ? sup.description : `Débloqué au niveau ${sup.unlockLevel}`}</div>
              </div>
            </div>
            <div className="sup-stats">
              <span>
                Qualité <b className="stars">{qualityStars(sup.quality)}</b>
              </span>
              <span>
                Prix <b className={f < 0.95 ? 'pos' : f > 1.05 ? 'neg' : ''}>{Math.round(f * 100)} %</b>
              </span>
              <span>
                Délai <b>{delayLabel(sup)}</b>
              </span>
              <span>
                Min. <b>{sup.minOrder ? euros(sup.minOrder, 0) : '—'}</b>
              </span>
            </div>
            <div className="sup-cats">{sup.categories.map((k) => CATEGORY_MAP[k].icon).join(' ')}</div>
          </button>
        );
      })}
    </div>
  );
}

function SupplierCatalog(props: { supplierId: string; onBack: () => void }) {
  const c = useController();
  const s = c.engine.state;
  const sup = SUPPLIER_MAP[props.supplierId];
  const [cart, setCart] = useState<Record<string, number>>(() =>
    c.orderDraft?.supplierId === props.supplierId ? { ...c.orderDraft.lines } : {},
  );
  useEffect(() => {
    if (c.orderDraft) c.orderDraft = null;
  }, [c]);
  const [onlyMine, setOnlyMine] = useState(false);
  const ids = supplierCatalog(s, sup.id).filter((pid) => !onlyMine || shelfCapacity(s, pid) > 0);
  const pending = new Map<string, number>();
  for (const o of s.orders) if (o.status !== 'received') for (const l of o.lines) pending.set(l.productId, (pending.get(l.productId) ?? 0) + l.qty);
  const total = Object.entries(cart).reduce((a, [pid, q]) => a + supplierUnitCost(s, sup.id, pid) * q, 0);
  const items = Object.values(cart).reduce((a, b) => a + b, 0);

  const suggest = () => {
    const next = suggestOrder(s, sup.id);
    if (!Object.keys(next).length) {
      c.toast(s.furniture.some((f) => f.slots.length) ? 'Vos rayons sont déjà bien remplis pour ce fournisseur.' : 'Installez d’abord des rayons (🛠️ Aménager) pour recevoir une suggestion.', 'info');
    }
    setCart(next);
  };

  const order = () => {
    const lines = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([productId, qty]) => ({ productId, qty }));
    const r = c.engine.placeOrder(sup.id, lines);
    if (c.result(r, `Commande passée (${euros(total)})`)) setCart({});
  };

  const arrivalText = (() => {
    if (sup.delayDays === 1) return 'demain matin (07:00)';
    if (sup.delayDays > 1) return `dans ${sup.delayDays} jours (07:00)`;
    const base = s.phase === 'report' ? 420 : Math.max(420, s.minute);
    const t = base + sup.delayMinutes;
    if (s.phase === 'report' || t > 1170) return s.phase === 'report' ? `demain vers ${clock(420 + sup.delayMinutes)}` : 'demain matin (07:00)';
    return `aujourd’hui vers ${clock(t)}`;
  })();

  return (
    <div className="catalog">
      <div className="cat-head">
        <button className="btn small" onClick={props.onBack}>
          ← Fournisseurs
        </button>
        <div className="row-name">
          {sup.icon} {sup.name}
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={suggest} data-testid="btn-suggest">
          ✨ Suggestion (remplir mes rayons)
        </button>
        <label className="chip toggle">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> En rayon
        </label>
      </div>
      {ids.length === 0 ? (
        <Empty icon="📭">Aucun produit disponible. Débloquez de nouvelles catégories en progressant.</Empty>
      ) : (
        <div className="list">
          {ids.map((pid) => {
            const p = PRODUCT_MAP[pid];
            const cost = supplierUnitCost(s, sup.id, pid);
            const q = supplierQuality(sup.id, pid);
            const cap = shelfCapacity(s, pid);
            return (
              <div key={pid} className="order-row">
                <div className="order-info">
                  <div className="row-name">
                    {p.icon} {p.name}
                  </div>
                  <div className="order-sub">
                    {euros(cost, 2)} · marché {euros(p.marketPrice, 2)} · Q {q}
                    <br />
                    rayon {shelfStock(s, pid)}/{cap} · réserve {s.products[pid].reserve}
                    {pending.get(pid) ? ` · en route ${pending.get(pid)}` : ''} · {averageSales(s.products[pid]).toFixed(1).replace('.', ',')}/j
                  </div>
                </div>
                <Stepper value={cart[pid] ?? 0} onChange={(v) => setCart({ ...cart, [pid]: v })} steps={[1, 10]} max={2000} />
              </div>
            );
          })}
        </div>
      )}
      <div className="cart-bar">
        <div>
          <div>
            <b>{items}</b> articles · <b>{euros(total)}</b>
          </div>
          <div className="order-sub">
            {sup.minOrder > 0 && total < sup.minOrder ? <span className="neg">Minimum {euros(sup.minOrder, 0)} · </span> : null}
            Livraison {arrivalText} · Trésorerie après : {compactEuros(s.cash - total)}
          </div>
        </div>
        <button className="btn primary" disabled={items === 0 || total > s.cash || total < sup.minOrder} onClick={order} data-testid="btn-order">
          Commander
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Commandes

function OrdersTab() {
  const c = useController();
  const s = c.engine.state;
  const arrived = s.orders.filter((o) => o.status === 'arrived');
  const transit = s.orders.filter((o) => o.status === 'transit');
  const history = s.orders.filter((o) => o.status === 'received').slice(-25).reverse();
  const when = (day: number, minute: number) => (day === s.day ? `aujourd’hui ${clock(minute)}` : day === s.day + 1 ? `demain ${clock(minute)}` : `jour ${day} ${clock(minute)}`);
  return (
    <div className="list">
      <h3>🚚 Arrivées ({arrived.length})</h3>
      {arrived.length === 0 && <p className="hint">Aucun camion en attente.</p>}
      {arrived.map((o) => (
        <div key={o.id} className="order-card arrived">
          <div>
            <b>n°{o.id}</b> {SUPPLIER_MAP[o.supplierId].name} · {o.lines.reduce((a, l) => a + l.qty, 0)} articles
          </div>
          <button
            className="btn small primary"
            onClick={() => {
              c.pickup();
              c.setTab('store');
            }}
          >
            Récupérer
          </button>
        </div>
      ))}
      <h3>⏳ En route ({transit.length})</h3>
      {transit.length === 0 && <p className="hint">Aucune commande en cours.</p>}
      {transit.map((o) => (
        <div key={o.id} className="order-card">
          <div>
            <b>n°{o.id}</b> {SUPPLIER_MAP[o.supplierId].name} · {euros(o.total)}
            <div className="order-sub">
              Arrivée prévue {when(o.arrivalDay, o.arrivalMinute)} · {o.lines.map((l) => `${PRODUCT_MAP[l.productId].icon}${l.qty}`).join(' ')}
            </div>
          </div>
        </div>
      ))}
      <h3>🗂️ Historique</h3>
      {history.length === 0 && <p className="hint">Pas encore de commande réceptionnée.</p>}
      {history.map((o) => (
        <div key={o.id} className="order-card done">
          <div>
            <b>n°{o.id}</b> jour {o.placedDay} · {SUPPLIER_MAP[o.supplierId].name} · {euros(o.total)}
            <div className="order-sub">{o.lines.map((l) => `${PRODUCT_MAP[l.productId].icon}${l.qty}`).join(' ')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Marketing

function MarketingTab() {
  const c = useController();
  const s = c.engine.state;
  const [scope, setScope] = useState<PromoScope>('category');
  const [target, setTarget] = useState<string>(s.unlockedCategories[0]);
  const [discount, setDiscount] = useState(0.2);
  const [days, setDays] = useState(3);
  const productOptions = PRODUCTS.filter((p) => isProductUnlocked(s, p.id) && shelfCapacity(s, p.id) > 0);
  useEffect(() => {
    if (scope === 'category') setTarget(s.unlockedCategories[0]);
    if (scope === 'product') setTarget(productOptions[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <div className="list">
      <h3>📣 Campagnes</h3>
      <p className="hint">Les campagnes augmentent temporairement la fréquentation (et parfois la réputation).</p>
      {CAMPAIGNS.map((cp) => {
        const active = s.campaigns.find((x) => x.id === cp.id);
        const locked = s.level < cp.unlockLevel;
        return (
          <div key={cp.id} className={`camp-card ${locked ? 'locked' : ''} ${active ? 'active' : ''}`}>
            <div className="camp-head">
              <span className="camp-icon">{locked ? '🔒' : cp.icon}</span>
              <div className="camp-body">
                <div className="row-name">{cp.name}</div>
                <div className="sup-desc">{cp.description}</div>
                <div className="order-sub">
                  +{Math.round(cp.traffic * 100)} % fréquentation · {cp.days} jours{cp.repPerDay ? ` · réputation +${cp.repPerDay}/j` : ''}
                  {cp.segments.length ? ` · cible : ${cp.segments.map((x) => SEGMENT_MAP[x].name).join(', ')}` : ''}
                </div>
              </div>
            </div>
            <div className="camp-foot">
              <b>{euros(cp.cost, 0)}</b>
              {active ? (
                <Badge tone="good">En cours · {active.daysLeft} j</Badge>
              ) : locked ? (
                <Badge tone="neutral">Niveau {cp.unlockLevel}</Badge>
              ) : (
                <button className="btn small primary" disabled={s.cash < cp.cost} onClick={() => c.result(c.engine.launchCampaign(cp.id), `Campagne « ${cp.name} » lancée`)}>
                  Lancer
                </button>
              )}
            </div>
          </div>
        );
      })}

      <h3>🏷️ Promotions</h3>
      <div className="card form">
        <label>
          Portée
          <select value={scope} onChange={(e) => setScope(e.target.value as PromoScope)}>
            <option value="product">Un produit</option>
            <option value="category">Une catégorie</option>
            <option value="store">Tout le magasin</option>
          </select>
        </label>
        {scope === 'category' && (
          <label>
            Catégorie
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {s.unlockedCategories.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_MAP[k].icon} {CATEGORY_MAP[k].name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === 'product' && (
          <label>
            Produit
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="seg">
          {[0.1, 0.2, 0.3].map((d) => (
            <button key={d} className={discount === d ? 'active' : ''} onClick={() => setDiscount(d)}>
              −{d * 100} %
            </button>
          ))}
        </div>
        <div className="seg">
          {[1, 3, 7].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d} jour{d > 1 ? 's' : ''}
            </button>
          ))}
        </div>
        <button
          className="btn primary wide"
          onClick={() => c.result(c.engine.createPromotion(scope, scope === 'store' ? null : target, discount, days), 'Promotion activée')}
          disabled={scope === 'product' && !target}
        >
          Activer la promotion
        </button>
        <p className="hint">Une promotion baisse votre marge mais attire les clients sensibles aux prix (surtout pendant les soldes et le Black Friday).</p>
      </div>
      {s.promotions.length === 0 ? (
        <p className="hint">Aucune promotion active.</p>
      ) : (
        s.promotions.map((p) => (
          <div key={p.id} className="order-card">
            <div>
              <b>{promotionLabel(p)}</b>{' '}
              {p.scope === 'product' ? PRODUCT_MAP[p.target!]?.name : p.scope === 'category' ? CATEGORY_MAP[p.target as CategoryId]?.name : ''}
              <div className="order-sub">Encore {p.daysLeft} jour(s)</div>
            </div>
            <button className="btn small" onClick={() => c.engine.cancelPromotion(p.id)}>
              Arrêter
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Rapports

function ReportsTab() {
  const c = useController();
  const s = c.engine.state;
  const [open, setOpen] = useState<DayRecord | null>(null);
  const list = s.history.slice(-30).reverse();
  if (open) {
    return (
      <div>
        <button className="btn small" onClick={() => setOpen(null)}>
          ← Rapports
        </button>
        <DayReportView record={open} previous={s.history.find((r) => r.day === open.day - 1)} />
      </div>
    );
  }
  return (
    <div className="list">
      {list.length === 0 && <Empty icon="🧾">Le premier bilan sera disponible à la fin de la journée.</Empty>}
      {list.map((r) => (
        <button key={r.day} className="row-card compact" onClick={() => setOpen(r)}>
          <span className="row-name">Jour {r.day}</span>
          <span className="row-meta">
            CA {compactEuros(r.revenue)} · <span className={r.profit < 0 ? 'neg' : 'pos'}>{compactEuros(r.profit)}</span> · {r.customers} clients
          </span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Marché

function MarketTab() {
  const c = useController();
  const s = c.engine.state;
  const rep = s.marketReports[s.marketReports.length - 1];
  if (!rep) {
    const d = dateInfo(s.day);
    return (
      <Empty icon="📈">
        Le premier rapport de marché arrivera au début du mois prochain (dans {14 - d.dayOfMonth + 1} jour(s)).
        <br />
        Concurrents : {s.competitors.map((x) => x.name).join(', ')}.
      </Empty>
    );
  }
  return <MarketReportView report={rep} history={s.marketReports} />;
}

export function MarketReportView(props: { report: MarketReport; history?: MarketReport[] }) {
  const r = props.report;
  const diff = r.playerShare - r.previousShare;
  const parts = [{ name: 'Vous', value: r.playerShare, color: '#e4572e' }, ...r.competitors.map((x) => ({ name: x.name, value: x.share, color: x.color }))];
  const hist = props.history ?? [];
  return (
    <div className="list">
      <h3>
        Rapport de marché — {MONTH_NAMES[r.month]} (An {r.year})
      </h3>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Votre part de marché</div>
          <div className="kpi-value">{pct(r.playerShare, 1)}</div>
          <div className={`kpi-sub ${diff >= 0 ? 'pos' : 'neg'}`}>
            {diff >= 0 ? '↑' : '↓'} {pct(Math.abs(diff), 1)} vs mois précédent
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">CA du mois</div>
          <div className="kpi-value">{compactEuros(r.playerRevenue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vos prix</div>
          <div className="kpi-value">{pct(r.playerPriceIndex)}</div>
          <div className="kpi-sub">marché : {pct(r.marketAvgPrice)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Réputation</div>
          <div className="kpi-value">{Math.round(r.playerReputation)}</div>
          <div className="kpi-sub">moyenne concurrents : {Math.round(r.marketAvgReputation)}</div>
        </div>
      </div>
      <h3>Parts de marché</h3>
      <ShareBar parts={parts} />
      {hist.length > 1 && (
        <>
          <h3>Évolution de votre part</h3>
          <LineChart
            series={[{ name: 'Part de marché', color: '#e4572e', values: hist.map((h) => h.playerShare * 100) }]}
            labels={hist.map((h) => MONTH_NAMES[h.month].slice(0, 3))}
            format={(v) => v.toFixed(1) + ' %'}
          />
        </>
      )}
      <h3>Concurrents</h3>
      <div className="table">
        <div className="tr th">
          <span>Enseigne</span>
          <span>Part</span>
          <span>Prix</span>
          <span>Rép.</span>
        </div>
        {r.competitors.map((x) => (
          <div key={x.id} className="tr">
            <span>
              <i className="dot" style={{ background: x.color }} /> {x.name}
            </span>
            <span>{pct(x.share, 1)}</span>
            <span>{pct(x.priceIndex)}</span>
            <span>{Math.round(x.reputation)}</span>
          </div>
        ))}
      </div>
      <h3>Vos catégories les plus performantes</h3>
      {r.topCategories.length === 0 && <p className="hint">Pas encore de ventes ce mois-ci.</p>}
      {r.topCategories.map((t) => (
        <div key={t.category} className="kv-line">
          <span>
            {CATEGORY_MAP[t.category].icon} {CATEGORY_MAP[t.category].name}
          </span>
          <b>{compactEuros(t.revenue)}</b>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Catalogue

function CatalogTab() {
  const c = useController();
  const s = c.engine.state;
  return (
    <div className="list">
      <p className="hint">
        {PRODUCTS.filter((p) => isProductUnlocked(s, p.id)).length} / {PRODUCTS.length} produits débloqués.
      </p>
      {CATEGORIES.map((cat) => {
        const unlocked = s.unlockedCategories.includes(cat.id);
        return (
          <div key={cat.id} className={`card ${unlocked ? '' : 'locked'}`}>
            <h3>
              {cat.icon} {cat.name}{' '}
              {!unlocked && (
                <Badge tone="neutral">
                  Niv. {cat.unlockLevel}
                  {cat.minStoreLevel > 1 ? ` + magasin ${cat.minStoreLevel}` : ''}
                </Badge>
              )}
            </h3>
            <div className="catalog-grid">
              {PRODUCTS.filter((p) => p.category === cat.id).map((p) => {
                const ok = isProductUnlocked(s, p.id);
                return (
                  <div key={p.id} className={`cat-item ${ok ? '' : 'locked'}`}>
                    <span className="cat-icon">{ok ? p.icon : '🔒'}</span>
                    <span className="cat-name">{p.name}</span>
                    <span className="cat-meta">{ok ? euros(p.marketPrice, 2) : `Niv. ${p.unlockLevel}`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
