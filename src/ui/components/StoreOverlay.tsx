import { useEffect, useRef, useState } from 'react';
import { FURNITURE, FURNITURE_MAP } from '../../data/furniture';
import { TUTORIAL_STEPS } from '../../game/engine';
import { reserveCapacity, reserveUsed } from '../../game/store/stock';
import { compactEuros, euros } from '../../utils/format';
import { useController } from '../hooks';
import { Progress } from './common';

export function tutorialTarget(step: number): string | null {
  return ['build', 'build', 'nav-computer', 'start', 'truck', 'nav-stock', null, null][step] ?? null;
}

export function StoreOverlay() {
  const c = useController();
  const s = c.engine.state;
  const t = s.tutorial;
  const target = t.active ? tutorialTarget(t.step) : null;
  const arrived = s.orders.filter((o) => o.status === 'arrived').length;
  const avatarBusy = c.engine.avatar.task.type !== 'idle' || c.engine.pickupQueue.length > 0;
  const used = reserveUsed(s);
  const cap = reserveCapacity(s);
  const [objOpen, setObjOpen] = useState(true);
  const objectives = s.objectives.filter((o) => !o.done);
  const coachRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = coachRef.current;
    if (!el) return;
    const update = () => c.setCoachHeight(el.getBoundingClientRect().height);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      c.setCoachHeight(0);
    };
  }, [c]);

  return (
    <>
      {/* Coach tutoriel ou objectifs */}
      <div className="coach" ref={coachRef}>
        {t.active && !t.done ? (
          <div className="coach-card tuto">
            <div className="coach-step">
              Tutoriel {Math.min(t.step + 1, TUTORIAL_STEPS.length)}/{TUTORIAL_STEPS.length}
            </div>
            <div className="coach-title">{TUTORIAL_STEPS[Math.min(t.step, TUTORIAL_STEPS.length - 1)].title}</div>
            <div className="coach-text">{TUTORIAL_STEPS[Math.min(t.step, TUTORIAL_STEPS.length - 1)].text}</div>
            <button className="link-btn" onClick={() => c.engine.skipTutorial()}>
              Passer le tutoriel
            </button>
          </div>
        ) : (
          objectives.length > 0 && (
            <div className="coach-card" onClick={() => setObjOpen(!objOpen)}>
              <div className="coach-step">🎯 Objectifs {objOpen ? '▾' : '▸'}</div>
              {objOpen &&
                objectives.slice(0, 3).map((o) => (
                  <div key={o.id} className="obj-mini">
                    <div className="obj-mini-text">{o.text}</div>
                    {o.target > 1 && <Progress value={o.progress / o.target} />}
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      {/* Boutons flottants */}
      <div className="fabs">
        <button className={`fab ${target === 'build' ? 'pulse' : ''}`} onClick={() => c.enterBuild()} data-testid="btn-build">
          <span>🛠️</span>
          <small>Aménager</small>
        </button>
        <button
          className="fab"
          onClick={() => {
            const n = c.engine.restock();
            c.toast(n ? `🔄 ${n} rayon${n > 1 ? 's' : ''} réapprovisionné${n > 1 ? 's' : ''}` : 'Rien à réapprovisionner depuis la réserve', n ? 'good' : 'info', 2);
          }}
        >
          <span>🔄</span>
          <small>Réassort</small>
        </button>
        <button className="fab small" onClick={() => c.renderer?.zoomAt(c.renderer.width / 2, c.renderer.height / 2, 1.25, s.storeLevel)} aria-label="Zoomer">
          ＋
        </button>
        <button className="fab small" onClick={() => c.renderer?.zoomAt(c.renderer.width / 2, c.renderer.height / 2, 0.8, s.storeLevel)} aria-label="Dézoomer">
          －
        </button>
        <button className="fab small" onClick={() => c.recenter()} aria-label="Recentrer">
          ⌖
        </button>
      </div>

      {/* Actions principales */}
      <div className="store-actions">
        {arrived > 0 && (
          <button className={`pill truck ${target === 'truck' ? 'pulse' : ''}`} onClick={() => c.pickup()} disabled={avatarBusy} data-testid="btn-pickup">
            🚚 {avatarBusy ? 'Réception en cours…' : `Récupérer la livraison${arrived > 1 ? ` (${arrived})` : ''}`}
          </button>
        )}
        {used > cap && (
          <div className="pill warn">
            📦 Réserve saturée ({used}/{cap}) — frais de stockage
          </div>
        )}
        {s.phase === 'prep' && (
          <button className={`big-btn start ${target === 'start' ? 'pulse' : ''}`} onClick={() => c.startDay()} data-testid="btn-start">
            ▶ Démarrer la journée
          </button>
        )}
        {(s.phase === 'running' || s.phase === 'closing') && (
          <div className="pill info">
            👥 {s.today.customers} clients · 💶 {compactEuros(s.today.revenue)} · 🛍️ {s.today.itemsSold}
          </div>
        )}
        {s.phase === 'report' && c.reportDismissed && (
          <button className="big-btn" onClick={() => c.nextDay()}>
            ☀️ Jour suivant
          </button>
        )}
      </div>
    </>
  );
}

export function BuildBar() {
  const c = useController();
  const s = c.engine.state;
  const b = c.build;
  const [cat, setCat] = useState<'shelf' | 'deco'>('shelf');
  if (!b.active) return null;

  if (b.ghost) {
    const def = FURNITURE_MAP[b.ghost.defId];
    return (
      <div className="build-bar">
        <div className={`build-msg ${b.ghost.valid ? 'ok' : 'bad'}`}>
          {def.icon} {def.name} — {b.message}
        </div>
        <div className="build-hint">Faites glisser le meuble ou touchez une case.</div>
        <div className="build-actions">
          <button className="btn" onClick={() => c.cancelGhost()}>
            ✕ Annuler
          </button>
          {def.w !== def.h && (
            <button className="btn" onClick={() => c.rotateGhost()}>
              ↻ Pivoter
            </button>
          )}
          <button className="btn primary" disabled={!b.ghost.valid} onClick={() => c.confirmGhost()} data-testid="btn-confirm-place">
            ✓ {b.ghost.movingUid ? 'Déplacer' : 'Acheter'}
          </button>
        </div>
      </div>
    );
  }

  if (b.selectedUid) {
    const f = c.engine.furnitureByUid(b.selectedUid);
    if (f) {
      const def = FURNITURE_MAP[f.defId];
      return (
        <div className="build-bar">
          <div className="build-msg">
            {def.icon} {def.name}
          </div>
          <div className="build-actions">
            <button className="btn" onClick={() => c.startMove(f.uid)}>
              ✥ Déplacer
            </button>
            {def.kind === 'shelf' && (
              <button
                className="btn"
                onClick={() => {
                  c.shelfSheet = f.uid;
                  c.bump();
                }}
              >
                🏷️ Produits
              </button>
            )}
            <button className="btn danger" onClick={() => c.sellFurniture(f.uid)}>
              💰 Revendre
            </button>
            <button
              className="btn"
              onClick={() => {
                c.build.selectedUid = null;
                c.bump();
              }}
            >
              ✕
            </button>
          </div>
        </div>
      );
    }
  }

  const items = FURNITURE.filter((f) => f.kind === cat);
  return (
    <div className="build-bar">
      <div className="build-top">
        <div className="seg">
          <button className={cat === 'shelf' ? 'active' : ''} onClick={() => setCat('shelf')}>
            Rayons
          </button>
          <button className={cat === 'deco' ? 'active' : ''} onClick={() => setCat('deco')}>
            Décoration
          </button>
        </div>
        <button className="btn primary" onClick={() => c.exitBuild()} data-testid="btn-build-done">
          Terminer
        </button>
      </div>
      <div className="palette">
        {items.map((f) => {
          const locked = s.level < f.unlockLevel;
          const needUp = f.requiresUpgrade && !s.upgrades.includes(f.requiresUpgrade);
          const tooExpensive = s.cash < f.cost;
          return (
            <button
              key={f.id}
              className={`pal-item ${locked || needUp ? 'locked' : ''} ${tooExpensive ? 'expensive' : ''}`}
              disabled={locked || !!needUp}
              onClick={() => c.startPlacing(f.id)}
              data-testid={`pal-${f.id}`}
            >
              <span className="pal-icon">{locked ? '🔒' : f.icon}</span>
              <span className="pal-name">{f.name}</span>
              <span className="pal-price">{locked ? `Niv. ${f.unlockLevel}` : needUp ? 'Amélioration' : euros(f.cost, 0)}</span>
              <span className="pal-size">
                {f.w}×{f.h}
                {f.slots ? ` · ${f.slots} empl.` : f.ambiance ? ` · ✨${f.ambiance}` : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="build-hint">Touchez un meuble déjà posé pour le déplacer ou le revendre. Zone rouge : entrée et caisses (fixes).</div>
    </div>
  );
}

export function Toasts() {
  const c = useController();
  return (
    <div className="toasts" aria-live="polite">
      {c.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
