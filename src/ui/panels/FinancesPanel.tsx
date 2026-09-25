import { CATEGORY_MAP } from '../../data/categories';
import { PRODUCT_MAP } from '../../data/products';
import { dailyCharges } from '../../game/economy/finance';
import type { CategoryId, DayRecord } from '../../game/types';
import { compactEuros, euros, pct } from '../../utils/format';
import { BarChart, LineChart } from '../components/charts';
import { Trend } from '../components/common';
import { useController } from '../hooks';

function sum(records: DayRecord[], f: (r: DayRecord) => number): number {
  return records.reduce((a, r) => a + f(r), 0);
}

export function FinancesPanel() {
  const c = useController();
  const s = c.engine.state;
  const t = s.today;
  // Journée affichée : en cours, sinon le dernier jour clôturé (avant l'ouverture et après la fermeture).
  const live = s.phase === 'running' || s.phase === 'closing' || s.history.length === 0;
  const cur: DayRecord = live ? t : s.history[s.history.length - 1];
  const prev = live ? s.history[s.history.length - 1] : s.history[s.history.length - 2];
  const ch = dailyCharges(s, cur.revenue);
  const projectedProfit = live ? cur.revenue - cur.cogs - cur.marketing - ch.total : cur.profit;
  const last7 = s.history.slice(-7);
  const last30 = s.history.slice(-30);
  const ca7 = sum(last7, (r) => r.revenue) + (live ? t.revenue : 0);
  const ca30 = sum(last30, (r) => r.revenue) + (live ? t.revenue : 0);
  const margin = cur.revenue > 0 ? (cur.revenue - cur.cogs) / cur.revenue : 0;
  const basket = cur.buyers > 0 ? cur.revenue / cur.buyers : 0;
  const conv = cur.customers > 0 ? cur.buyers / cur.customers : 0;
  const prevBasket = prev && prev.buyers > 0 ? prev.revenue / prev.buyers : undefined;
  const prevConv = prev && prev.customers > 0 ? prev.buyers / prev.customers : undefined;
  const prevMargin = prev && prev.revenue > 0 ? (prev.revenue - prev.cogs) / prev.revenue : undefined;
  const best = Object.entries(cur.productUnits).sort((a, b) => b[1] - a[1])[0];
  const ruptures = live ? Object.keys(s.products).filter((id) => s.products[id].stockoutsToday > 0).length : cur.stockoutProducts.length;

  const kpis = [
    { label: live ? 'CA aujourd’hui' : `CA jour ${cur.day}`, value: compactEuros(cur.revenue), cur: cur.revenue, prev: prev?.revenue },
    { label: live ? 'Profit estimé' : `Profit jour ${cur.day}`, value: compactEuros(projectedProfit), cur: projectedProfit, prev: prev?.profit, neg: projectedProfit < 0 },
    { label: 'Clients', value: String(cur.customers), cur: cur.customers, prev: prev?.customers },
    { label: 'Conversion', value: pct(conv), cur: conv, prev: prevConv },
    { label: 'Panier moyen', value: euros(basket), cur: basket, prev: prevBasket },
    { label: 'Marge brute', value: pct(margin), cur: margin, prev: prevMargin },
    { label: 'Réputation', value: String(Math.round(s.reputation)), cur: s.reputation, prev: prev?.repEnd },
    { label: 'Trésorerie', value: compactEuros(s.cash), cur: s.cash, prev: prev?.cashEnd, neg: s.cash < 0 },
    { label: 'CA 7 jours', value: compactEuros(ca7) },
    { label: 'CA 30 jours', value: compactEuros(ca30) },
    { label: 'Ruptures', value: String(ruptures), cur: ruptures, prev: prev?.stockoutProducts.length, invert: true },
    { label: 'Meilleure vente', value: best ? `${PRODUCT_MAP[best[0]].icon} ${best[1]}` : '—' },
  ];

  const chart = s.history.slice(-14);
  const catRev = Object.entries(cur.categoryRevenue).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [CategoryId, number][];

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>📊 Finances</h2>
        <div className="panel-sub">Comparaison avec la veille : ↑ ↓ →</div>
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.neg ? 'neg' : ''}`}>
              {k.value} {k.cur !== undefined && <Trend current={k.cur} previous={k.prev} invert={k.invert} />}
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        <h3>{live ? 'Compte du jour (en cours)' : `Compte du jour ${cur.day}`}</h3>
        <div className="ledger">
          <span>Chiffre d’affaires</span>
          <b className="pos">{euros(cur.revenue)}</b>
          <span>Coût des marchandises vendues</span>
          <b>−{euros(cur.cogs)}</b>
          <span>Marketing</span>
          <b>−{euros(cur.marketing)}</b>
          <span>Loyer & charges{live ? ' (prévu)' : ''}</span>
          <b>−{euros(live ? ch.rent + ch.electricity + ch.maintenance + ch.storage : cur.charges)}</b>
          <span>Taxes (3 % du CA){live ? ' (prévu)' : ''}</span>
          <b>−{euros(live ? ch.taxes : cur.taxes)}</b>
          <span className="total">Résultat</span>
          <b className={`total ${projectedProfit < 0 ? 'neg' : 'pos'}`}>{euros(projectedProfit)}</b>
        </div>
        <div className="ledger sub">
          <span>Achats de stock (trésorerie)</span>
          <b>{euros(cur.purchases)}</b>
          <span>Investissements (meubles, travaux…)</span>
          <b>{euros(cur.investments)}</b>
        </div>
        <details>
          <summary>Détail des charges journalières</summary>
          <div className="ledger sub">
            <span>Loyer</span>
            <b>{euros(ch.rent)}</b>
            <span>Électricité</span>
            <b>{euros(ch.electricity)}</b>
            <span>Entretien</span>
            <b>{euros(ch.maintenance)}</b>
            <span>Stockage externe (réserve saturée)</span>
            <b>{euros(ch.storage)}</b>
          </div>
        </details>
      </section>

      <section className="card">
        <h3>CA et résultat — 14 derniers jours</h3>
        {chart.length ? (
          <BarChart data={chart.map((r) => ({ label: String(r.day), value: r.revenue, value2: r.profit }))} legend={['CA', 'Résultat']} />
        ) : (
          <p className="hint">Les graphiques apparaîtront après la première journée.</p>
        )}
      </section>
      {s.history.length > 1 && (
        <section className="card">
          <h3>Trésorerie & clients — 30 jours</h3>
          <LineChart series={[{ name: 'Trésorerie', color: '#3d7dd8', values: last30.map((r) => r.cashEnd) }]} labels={last30.map((r) => String(r.day))} />
          <BarChart data={last30.map((r) => ({ label: String(r.day), value: r.customers }))} color="#f4a261" format={(v) => String(Math.round(v))} legend={['Clients']} height={100} />
        </section>
      )}
      <section className="card">
        <h3>Ventes par catégorie</h3>
        {catRev.length === 0 && <p className="hint">Aucune vente pour le moment.</p>}
        {catRev.map(([k, v]) => (
          <div key={k} className="bar-line">
            <span>
              {CATEGORY_MAP[k].icon} {CATEGORY_MAP[k].name}
            </span>
            <div className="bar-track">
              <div style={{ width: `${(v / Math.max(1, cur.revenue)) * 100}%`, background: CATEGORY_MAP[k].color }} />
            </div>
            <b>{compactEuros(v)}</b>
          </div>
        ))}
      </section>
      <section className="card">
        <h3>Depuis l’ouverture</h3>
        <div className="kv-grid">
          <span>CA cumulé</span>
          <b>{compactEuros(s.totalRevenue)}</b>
          <span>Résultat cumulé</span>
          <b className={s.totalProfit < 0 ? 'neg' : ''}>{compactEuros(s.totalProfit)}</b>
          <span>Clients accueillis</span>
          <b>{s.lifetime.customers.toLocaleString('fr-FR')}</b>
          <span>Articles vendus</span>
          <b>{s.lifetime.itemsSold.toLocaleString('fr-FR')}</b>
          <span>Jours rentables</span>
          <b>{s.lifetime.profitableDays}</b>
        </div>
      </section>
    </div>
  );
}
