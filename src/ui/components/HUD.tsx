import { dateInfo } from '../../game/calendar/calendar';
import { levelProgress } from '../../game/progression/progression';
import { clock, compactEuros } from '../../utils/format';
import type { Speed } from '../controller';
import { useController, useTicker } from '../hooks';

export function HUD() {
  const c = useController();
  useTicker(250);
  const s = c.engine.state;
  const d = dateInfo(s.day);
  const lp = levelProgress(s);
  const phaseLabel =
    s.phase === 'prep' ? 'Préparation' : s.phase === 'running' ? (s.minute < 480 ? 'Mise en place' : 'Ouvert') : s.phase === 'closing' ? 'Fermeture' : 'Fermé';
  const speeds: { v: Speed; label: string; aria: string }[] = [
    { v: 0, label: '⏸', aria: 'Pause' },
    { v: 1, label: '▶', aria: 'Vitesse x1' },
    { v: 2, label: '▶▶', aria: 'Vitesse x2' },
    { v: 4, label: '▶▶▶', aria: 'Vitesse x4' },
  ];
  const running = s.phase === 'running' || s.phase === 'closing';
  return (
    <header className="hud">
      <div className="hud-row">
        <div className="hud-date">
          <div className="hud-day">Jour {s.day}</div>
          <div className="hud-sub">{d.short}</div>
        </div>
        <div className={`hud-clock ${s.phase}`}>
          <div className="hud-time">{clock(s.minute)}</div>
          <div className="hud-sub">{phaseLabel}</div>
        </div>
        <div className={`hud-cash ${s.cash < 0 ? 'neg' : ''}`} data-testid="cash">
          {compactEuros(s.cash)}
        </div>
      </div>
      <div className="hud-row small">
        <div className="hud-rep" title="Réputation">
          <span>⭐ {Math.round(s.reputation)}</span>
          <div className="mini-bar">
            <div style={{ width: `${s.reputation}%`, background: '#ffb703' }} />
          </div>
        </div>
        <div className="hud-level" title="Niveau">
          <span className="lvl-badge">Niv. {s.level}</span>
          <div className="mini-bar">
            <div style={{ width: `${lp.ratio * 100}%`, background: '#06d6a0' }} />
          </div>
        </div>
        <div className="speed-group" role="group" aria-label="Vitesse">
          {speeds.map((sp) => (
            <button
              key={sp.v}
              aria-label={sp.aria}
              className={`speed-btn ${c.speed === sp.v ? 'active' : ''}`}
              disabled={!running && sp.v !== 0}
              onClick={() => c.setSpeed(sp.v)}
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
