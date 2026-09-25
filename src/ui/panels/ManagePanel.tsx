import { useState } from 'react';
import { CALENDAR_EVENTS, MONTH_NAMES, SEASON_ICONS, SEASON_NAMES } from '../../data/calendar';
import { CATEGORIES } from '../../data/categories';
import { MILESTONES } from '../../data/progression';
import { FLOOR_STYLES, MAIN_COLORS, SIGN_STYLES, STORE_LEVELS, UPGRADES, WALL_STYLES, type StyleDef } from '../../data/store';
import { activeCalendarEvents, dateInfo, upcomingCalendarEvents } from '../../game/calendar/calendar';
import { xpForLevel } from '../../game/constants';
import { ambianceScore } from '../../game/economy/finance';
import { levelProgress, unlocksAtLevel } from '../../game/progression/progression';
import { deleteSave, savePrefs } from '../../save/save';
import { audio } from '../../audio/audio';
import { compactEuros, euros } from '../../utils/format';
import { Badge, Progress, Tabs } from '../components/common';
import { useController } from '../hooks';

type MTab = 'objectives' | 'expand' | 'upgrades' | 'custom' | 'calendar' | 'journal' | 'settings';

export function ManagePanel() {
  const c = useController();
  const tab = c.manageTab as MTab;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>⚙️ Gestion</h2>
      </div>
      <Tabs
        value={tab}
        onChange={(v) => {
          c.manageTab = v;
          c.bump();
        }}
        options={[
          { id: 'objectives', label: '🎯 Objectifs' },
          { id: 'expand', label: '🏗️ Agrandir' },
          { id: 'upgrades', label: '✨ Améliorations' },
          { id: 'custom', label: '🎨 Personnaliser' },
          { id: 'calendar', label: '📅 Calendrier' },
          { id: 'journal', label: '📰 Journal' },
          { id: 'settings', label: '🔧 Paramètres' },
        ]}
      />
      <div className="panel-content">
        {tab === 'objectives' && <ObjectivesTab />}
        {tab === 'expand' && <ExpandTab />}
        {tab === 'upgrades' && <UpgradesTab />}
        {tab === 'custom' && <CustomTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'journal' && <JournalTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function ObjectivesTab() {
  const c = useController();
  const s = c.engine.state;
  const lp = levelProgress(s);
  return (
    <div className="list">
      <section className="card">
        <h3>Niveau {s.level}</h3>
        <Progress value={lp.ratio} tone="#06d6a0" />
        <div className="order-sub">
          {s.level >= 20 ? 'Niveau maximal atteint !' : `${Math.floor(s.xp).toLocaleString('fr-FR')} / ${xpForLevel(s.level + 1).toLocaleString('fr-FR')} XP — l’XP vient de votre marge brute et des objectifs.`}
        </div>
        {s.level < 20 && (
          <div className="unlock-list">
            <b>Au niveau {s.level + 1} :</b> {unlocksAtLevel(s.level + 1).join(' · ') || 'nouvelles possibilités'}
          </div>
        )}
      </section>
      <h3>🎯 Objectifs en cours</h3>
      {s.objectives
        .filter((o) => !o.done)
        .map((o) => (
          <div key={o.id} className="card obj">
            <div className="row-name">{o.text}</div>
            {o.target > 1 && (
              <>
                <Progress value={o.progress / o.target} />
                <div className="order-sub">
                  {o.kind.startsWith('day') || o.kind === 'dayRevenue' || o.kind === 'dayProfit' ? (o.kind === 'dayCustomers' ? `${o.progress} / ${o.target}` : `${compactEuros(o.progress)} / ${compactEuros(o.target)}`) : `${Math.floor(o.progress)} / ${o.target}`}
                </div>
              </>
            )}
            <div className="order-sub">
              Récompense : {euros(o.rewardCash, 0)} · {o.rewardXp} XP{o.rewardRep ? ` · +${o.rewardRep} réputation` : ''}
            </div>
          </div>
        ))}
      <h3>🏆 Grands jalons ({s.milestones.length}/{MILESTONES.length})</h3>
      <div className="milestones">
        {MILESTONES.map((m) => {
          const done = s.milestones.includes(m.id);
          return (
            <div key={m.id} className={`milestone ${done ? 'done' : ''}`}>
              <span className="ms-icon">{done ? m.icon : '⬜'}</span>
              <div>
                <div className="row-name">{m.name}</div>
                <div className="order-sub">
                  {m.description} · {euros(m.rewardCash, 0)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandTab() {
  const c = useController();
  const s = c.engine.state;
  const cur = STORE_LEVELS[s.storeLevel - 1];
  const next = STORE_LEVELS[s.storeLevel];
  const check = c.engine.canExpand();
  return (
    <div className="list">
      <section className="card">
        <h3>
          🏪 {cur.name} (niveau {cur.level}/6)
        </h3>
        <div className="kv-grid">
          <span>Surface</span>
          <b>
            {cur.w} × {cur.h} cases
          </b>
          <span>Caisses</span>
          <b>{cur.checkouts}</b>
          <span>Loyer</span>
          <b>{euros(cur.rent, 0)} / jour</b>
          <span>Clients visibles max.</span>
          <b>{cur.maxVisible}</b>
        </div>
      </section>
      <div className="levels">
        {STORE_LEVELS.map((l) => (
          <div key={l.level} className={`level-step ${l.level <= s.storeLevel ? 'done' : ''} ${l.level === s.storeLevel + 1 ? 'next' : ''}`}>
            <div className="level-num">{l.level}</div>
            <div className="level-name">{l.name}</div>
          </div>
        ))}
      </div>
      {next ? (
        <section className="card highlight">
          <h3>Prochain agrandissement : {next.name}</h3>
          <div className="kv-grid">
            <span>Coût</span>
            <b className={s.cash < next.cost ? 'neg' : 'pos'}>{euros(next.cost, 0)}</b>
            <span>Niveau requis</span>
            <b className={s.level < next.requiredLevel ? 'neg' : 'pos'}>{next.requiredLevel}</b>
            <span>Nouvelle surface</span>
            <b>
              {next.w} × {next.h} (+{next.w * next.h - cur.w * cur.h} cases)
            </b>
            <span>Caisses</span>
            <b>{next.checkouts}</b>
            <span>Nouveau loyer</span>
            <b>{euros(next.rent, 0)} / jour</b>
            <span>Nouvelles catégories</span>
            <b>{CATEGORIES.filter((k) => k.minStoreLevel === next.level).map((k) => k.icon + ' ' + k.name).join(', ') || '—'}</b>
          </div>
          <Progress value={s.cash / next.cost} tone="#ffb703" />
          <button
            className="btn primary wide"
            disabled={!check.ok}
            onClick={() =>
              c.openConfirm({
                title: `Agrandir en ${next.name} ?`,
                text: `Coût : ${euros(next.cost, 0)}. Vos meubles sont conservés. Le loyer passera à ${euros(next.rent, 0)} par jour.`,
                confirmLabel: 'Lancer les travaux',
                onConfirm: () => c.result(c.engine.expandStore()),
              })
            }
            data-testid="btn-expand"
          >
            🏗️ Agrandir le magasin
          </button>
          {!check.ok && <p className="hint">{check.error}</p>}
        </section>
      ) : (
        <section className="card highlight">
          <h3>🏙️ Taille maximale atteinte !</h3>
          <p>Votre hypermarché est terminé. Continuez à développer votre chiffre d’affaires, votre réputation et votre part de marché.</p>
        </section>
      )}
    </div>
  );
}

function UpgradesTab() {
  const c = useController();
  const s = c.engine.state;
  return (
    <div className="list">
      {UPGRADES.map((u) => {
        const owned = s.upgrades.includes(u.id);
        const locked = s.level < u.unlockLevel || s.storeLevel < u.minStoreLevel || (u.requires && !s.upgrades.includes(u.requires));
        return (
          <div key={u.id} className={`camp-card ${owned ? 'active' : ''} ${locked ? 'locked' : ''}`}>
            <div className="camp-head">
              <span className="camp-icon">{locked && !owned ? '🔒' : u.icon}</span>
              <div className="camp-body">
                <div className="row-name">{u.name}</div>
                <div className="sup-desc">{u.description}</div>
                {locked && !owned && (
                  <div className="order-sub">
                    Requis : niveau {u.unlockLevel}
                    {u.minStoreLevel > 1 ? `, magasin ${u.minStoreLevel}` : ''}
                    {u.requires ? `, « ${UPGRADES.find((x) => x.id === u.requires)?.name} »` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="camp-foot">
              <b>{euros(u.cost, 0)}</b>
              {owned ? (
                <Badge tone="good">Installé</Badge>
              ) : (
                <button className="btn small primary" disabled={!!locked || s.cash < u.cost} onClick={() => c.result(c.engine.buyUpgrade(u.id), `${u.name} installé !`)}>
                  Acheter
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StylePicker(props: { title: string; kind: 'floor' | 'wall' | 'sign'; list: StyleDef[]; current: number; owned: number[] }) {
  const c = useController();
  const s = c.engine.state;
  return (
    <section className="card">
      <h3>{props.title}</h3>
      <div className="style-grid">
        {props.list.map((st) => {
          const owned = props.owned.includes(st.id);
          const locked = s.level < st.unlockLevel;
          return (
            <button
              key={st.id}
              className={`style-item ${props.current === st.id ? 'active' : ''}`}
              disabled={locked && !owned}
              onClick={() => c.result(c.engine.buyStyle(props.kind, st.id))}
            >
              <span className="swatch" style={{ background: `linear-gradient(135deg, ${st.colors[0]} 50%, ${st.colors[1]} 50%)` }} />
              <span className="pal-name">{st.name}</span>
              <span className="pal-price">{owned ? (props.current === st.id ? '✓ Actif' : 'Possédé') : locked ? `Niv. ${st.unlockLevel}` : euros(st.cost, 0)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CustomTab() {
  const c = useController();
  const s = c.engine.state;
  const cu = s.customization;
  const [name, setName] = useState(cu.storeName);
  return (
    <div className="list">
      <section className="card">
        <h3>Nom du magasin</h3>
        <div className="btn-row">
          <input className="text-input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Nom du magasin" />
          <button className="btn primary" onClick={() => c.result(c.engine.setStoreName(name), 'Nom enregistré')}>
            OK
          </button>
        </div>
      </section>
      <section className="card">
        <h3>Couleur principale</h3>
        <div className="colors">
          {MAIN_COLORS.map((col) => (
            <button key={col} className={`color-dot ${cu.mainColor === col ? 'active' : ''}`} style={{ background: col }} onClick={() => c.engine.setMainColor(col)} aria-label={col} />
          ))}
        </div>
      </section>
      <StylePicker title="Enseigne" kind="sign" list={SIGN_STYLES} current={cu.signStyle} owned={cu.ownedSigns} />
      <StylePicker title="Sol" kind="floor" list={FLOOR_STYLES} current={cu.floorStyle} owned={cu.ownedFloors} />
      <StylePicker title="Murs" kind="wall" list={WALL_STYLES} current={cu.wallStyle} owned={cu.ownedWalls} />
      <p className="hint">Ambiance actuelle : {Math.round(ambianceScore(s))} points. La décoration (plantes, lampes… via 🛠️ Aménager) et les styles améliorent légèrement la satisfaction.</p>
    </div>
  );
}

function CalendarTab() {
  const c = useController();
  const s = c.engine.state;
  const d = dateInfo(s.day);
  const active = activeCalendarEvents(s.day);
  const upcoming = upcomingCalendarEvents(s.day + 1, 42).filter((u) => !active.some((a) => a.id === u.event.id));
  return (
    <div className="list">
      <section className="card">
        <h3>
          {SEASON_ICONS[d.season]} {d.label}
        </h3>
        <div className="order-sub">
          Saison : {SEASON_NAMES[d.season]} · Un mois = 14 jours · Rapport de marché chaque début de mois
        </div>
      </section>
      <h3>En ce moment</h3>
      {active.length === 0 && <p className="hint">Période calme.</p>}
      {active.map((e) => (
        <div key={e.id} className="card">
          <b>
            {e.icon} {e.name}
          </b>
          <div className="order-sub">{e.description}</div>
        </div>
      ))}
      <h3>À venir</h3>
      {upcoming.map((u) => (
        <div key={u.event.id} className="kv-line">
          <span>
            {u.event.icon} {u.event.name}
          </span>
          <b>dans {u.inDays + 1} j</b>
        </div>
      ))}
      <h3>Calendrier annuel</h3>
      <div className="table">
        {CALENDAR_EVENTS.map((e) => (
          <div key={e.id} className="tr">
            <span>
              {e.icon} {e.name}
            </span>
            <span>
              {MONTH_NAMES[e.month]} {e.from}–{e.to}
            </span>
          </div>
        ))}
      </div>
      {s.modifiers.length > 0 && (
        <>
          <h3>Effets temporaires</h3>
          {s.modifiers.map((m) => (
            <div key={m.id} className="kv-line">
              <span>{m.label}</span>
              <b>{m.daysLeft} j</b>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function JournalTab() {
  const c = useController();
  const s = c.engine.state;
  return (
    <div className="list">
      {[...s.log].reverse().map((l, i) => (
        <div key={i} className={`log-line ${l.kind}`}>
          <span className="log-day">J{l.day}</span> {l.text}
        </div>
      ))}
      {s.log.length === 0 && <p className="hint">Rien pour le moment.</p>}
    </div>
  );
}

function SettingsTab() {
  const c = useController();
  const s = c.engine.state;
  return (
    <div className="list">
      <section className="card">
        <h3>Son</h3>
        <label className="switch-line">
          <input
            type="checkbox"
            checked={s.settings.sound}
            onChange={(e) => {
              s.settings.sound = e.target.checked;
              audio.enabled = e.target.checked;
              savePrefs({ sound: e.target.checked });
              c.bump();
            }}
          />
          Effets sonores
        </label>
      </section>
      <section className="card">
        <h3>Sauvegarde</h3>
        <p className="hint">La partie est sauvegardée automatiquement (fin de journée, toutes les 20 s et à la fermeture de l’onglet).</p>
        <div className="btn-row">
          <button className="btn" onClick={() => c.result({ ok: c.save(), error: 'Sauvegarde impossible (stockage indisponible)' }, 'Partie sauvegardée')}>
            💾 Sauvegarder
          </button>
          <button
            className="btn"
            onClick={() => {
              c.save();
              c.onExit?.();
            }}
          >
            🏠 Menu principal
          </button>
        </div>
      </section>
      <section className="card">
        <h3>Zone dangereuse</h3>
        <button
          className="btn danger wide"
          onClick={() =>
            c.openConfirm({
              title: 'Réinitialiser la partie ?',
              text: 'Toute votre progression sera définitivement supprimée.',
              confirmLabel: 'Supprimer ma partie',
              danger: true,
              onConfirm: () => {
                c.noSave = true;
                deleteSave();
                c.onExit?.();
              },
            })
          }
        >
          🗑️ Réinitialiser la partie
        </button>
      </section>
      <p className="hint">Commencée le jour 1 · Jour actuel {s.day} · CA cumulé {compactEuros(s.totalRevenue)}</p>
    </div>
  );
}
