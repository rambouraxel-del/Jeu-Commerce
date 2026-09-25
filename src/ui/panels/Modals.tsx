import { PRODUCT_MAP } from '../../data/products';
import { STORE_LEVELS } from '../../data/store';
import { dateInfo } from '../../game/calendar/calendar';
import type { DayRecord } from '../../game/types';
import { euros, pct } from '../../utils/format';
import { Modal, Trend } from '../components/common';
import { useController } from '../hooks';
import { MarketReportView } from './ComputerPanel';

export function DayReportView(props: { record: DayRecord; previous?: DayRecord }) {
  const r = props.record;
  const p = props.previous;
  const basket = r.buyers ? r.revenue / r.buyers : 0;
  const pBasket = p && p.buyers ? p.revenue / p.buyers : undefined;
  const conv = r.customers ? r.buyers / r.customers : 0;
  const repDiff = r.repEnd - r.repStart;
  return (
    <div className="report">
      <div className="report-date">{dateInfo(r.day).label}</div>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Chiffre d’affaires</div>
          <div className="kpi-value">
            {euros(r.revenue)} <Trend current={r.revenue} previous={p?.revenue} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Résultat</div>
          <div className={`kpi-value ${r.profit < 0 ? 'neg' : 'pos'}`}>
            {euros(r.profit)} <Trend current={r.profit} previous={p?.profit} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Clients</div>
          <div className="kpi-value">
            {r.customers} <Trend current={r.customers} previous={p?.customers} />
          </div>
          <div className="kpi-sub">{pct(conv)} ont acheté</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Articles vendus</div>
          <div className="kpi-value">
            {r.itemsSold} <Trend current={r.itemsSold} previous={p?.itemsSold} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Panier moyen</div>
          <div className="kpi-value">
            {euros(basket)} <Trend current={basket} previous={pBasket} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Réputation</div>
          <div className="kpi-value">
            {Math.round(r.repEnd)} <span className={repDiff >= 0 ? 'pos' : 'neg'}>({repDiff >= 0 ? '+' : ''}{repDiff.toFixed(1).replace('.', ',')})</span>
          </div>
          <div className="kpi-sub">satisfaction {Math.round(r.satisfaction)}/100</div>
        </div>
      </div>
      <div className="kv-grid">
        <span>Meilleur produit</span>
        <b>{r.bestProduct ? `${PRODUCT_MAP[r.bestProduct].icon} ${PRODUCT_MAP[r.bestProduct].name} (${r.bestProductQty})` : '—'}</b>
        <span>Coût des marchandises</span>
        <b>{euros(r.cogs)}</b>
        <span>Charges & taxes</span>
        <b>{euros(r.charges + r.taxes)}</b>
        <span>Marketing</span>
        <b>{euros(r.marketing)}</b>
        <span>Investissements</span>
        <b>{euros(r.investments)}</b>
        <span>Trésorerie</span>
        <b className={r.cashEnd < 0 ? 'neg' : ''}>{euros(r.cashEnd)}</b>
      </div>
      <div className={`rupture-box ${r.stockoutProducts.length ? 'bad' : 'good'}`}>
        {r.stockoutProducts.length ? (
          <>
            ⚠️ Ruptures ({r.stockouts} clients déçus) : {r.stockoutProducts.map((id) => PRODUCT_MAP[id].icon + ' ' + PRODUCT_MAP[id].name).join(', ')}
          </>
        ) : (
          <>✅ Aucune rupture de stock aujourd’hui.</>
        )}
      </div>
    </div>
  );
}

export function DayReportModal() {
  const c = useController();
  const s = c.engine.state;
  if (s.phase !== 'report' || c.reportDismissed || s.bankrupt) return null;
  const r = c.lastDayRecord ?? s.history[s.history.length - 1];
  if (!r) return null;
  const prev = s.history.find((x) => x.day === r.day - 1);
  return (
    <Modal
      title={`🌙 Bilan du jour ${r.day}`}
      onClose={() => {
        c.reportDismissed = true;
        c.bump();
      }}
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              c.reportDismissed = true;
              c.bump();
            }}
          >
            Gérer avant demain
          </button>
          <button className="btn primary" onClick={() => c.nextDay()} data-testid="btn-next-day">
            ☀️ Jour suivant
          </button>
        </>
      }
    >
      <DayReportView record={r} previous={prev} />
      {s.negativeDays > 0 && (
        <div className="rupture-box bad">
          🚨 Trésorerie critique depuis {s.negativeDays} jour(s). Réduisez vos dépenses ou revendez du mobilier pour éviter la faillite.
        </div>
      )}
    </Modal>
  );
}

export function EventModal() {
  const c = useController();
  const ev = c.engine.state.pendingEvents[0];
  if (!ev || c.engine.state.phase === 'report') return null;
  return (
    <Modal title={`📰 ${ev.title}`} className="event">
      <p className="event-text">{ev.text}</p>
      <div className="choices">
        {ev.choices.map((ch, i) => (
          <button key={i} className={`btn wide ${i === 0 ? 'primary' : ''}`} onClick={() => c.result(c.engine.resolveEvent(ev.id, i))}>
            {ch.label}
            {ch.detail && <small>{ch.detail}</small>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function LevelUpModal() {
  const c = useController();
  const lu = c.levelUps[0];
  if (!lu) return null;
  const close = () => {
    c.levelUps.shift();
    c.bump();
  };
  return (
    <Modal title="🎉 Niveau supérieur !" onClose={close} footer={<button className="btn primary" onClick={close}>Super !</button>}>
      <div className="levelup">
        <div className="levelup-num">{lu.level}</div>
        {lu.unlocks.length > 0 ? (
          <>
            <p>Nouveautés débloquées :</p>
            <ul className="unlocks">
              {lu.unlocks.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Continuez à développer votre commerce !</p>
        )}
      </div>
    </Modal>
  );
}

export function MonthReportModal() {
  const c = useController();
  const r = c.monthReports[0];
  if (!r || c.levelUps.length || c.engine.state.pendingEvents.length) return null;
  const close = () => {
    c.monthReports.shift();
    c.bump();
  };
  return (
    <Modal title="📈 Rapport de marché mensuel" onClose={close} footer={<button className="btn primary" onClick={close}>Fermer</button>} wide>
      <MarketReportView report={r} history={c.engine.state.marketReports} />
    </Modal>
  );
}

export function ExpansionModal() {
  const c = useController();
  const lvl = c.expansionShown;
  if (!lvl) return null;
  const def = STORE_LEVELS[lvl - 1];
  const close = () => {
    c.expansionShown = null;
    c.bump();
  };
  return (
    <Modal title="🏗️ Travaux terminés !" onClose={close} footer={<button className="btn primary" onClick={close}>Découvrir mon magasin</button>}>
      <div className="levelup">
        <div className="levelup-num">{def.name}</div>
        <ul className="unlocks">
          <li>
            Surface : {def.w} × {def.h} cases
          </li>
          <li>{def.checkouts} caisse(s)</li>
          <li>Jusqu’à {def.maxVisible} clients visibles en même temps</li>
          <li>Fréquentation de base plus élevée</li>
        </ul>
        <p className="hint">Pensez à installer de nouveaux rayons dans l’espace gagné !</p>
      </div>
    </Modal>
  );
}

export function GameOverModal() {
  const c = useController();
  const s = c.engine.state;
  if (!s.bankrupt) return null;
  return (
    <Modal title="💸 Faillite">
      <p>
        Votre trésorerie est restée très négative pendant trop longtemps. {s.customization.storeName} doit fermer ses portes après {s.day} jours.
      </p>
      <p>CA cumulé : {euros(s.totalRevenue)} · Meilleur niveau : {s.level}</p>
      <button
        className="btn primary wide"
        onClick={() => {
          c.noSave = true;
          c.onExit?.();
        }}
      >
        Retour au menu
      </button>
    </Modal>
  );
}

export function ConfirmDialog() {
  const c = useController();
  const cf = c.confirm;
  if (!cf) return null;
  return (
    <Modal
      title={cf.title}
      onClose={() => c.closeConfirm()}
      footer={
        <>
          <button className="btn" onClick={() => c.closeConfirm()}>
            Annuler
          </button>
          <button
            className={`btn ${cf.danger ? 'danger' : 'primary'}`}
            onClick={() => {
              c.closeConfirm();
              cf.onConfirm();
            }}
            data-testid="btn-confirm"
          >
            {cf.confirmLabel}
          </button>
        </>
      }
    >
      <p>{cf.text}</p>
    </Modal>
  );
}
