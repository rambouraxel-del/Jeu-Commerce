import { GameEngine } from '../src/game/engine';

/** Partie de test : un magasin avec une étagère et un frigo, déjà approvisionné. */
export function setupStore(seed = 1): GameEngine {
  const e = GameEngine.newGame({ seed, headless: true });
  e.state.tutorial.active = false;
  const a = e.buyFurniture('etagere', 0, 0, 0);
  const b = e.buyFurniture('frigo', 3, 0, 0);
  const c = e.buyFurniture('etagere', 0, 2, 0);
  if (!a.ok || !b.ok || !c.ok) throw new Error('setup: placement impossible');
  const r = e.placeOrder('grossiste', [
    { productId: 'lait', qty: 14 },
    { productId: 'oeufs', qty: 14 },
    { productId: 'pates', qty: 14 },
    { productId: 'riz', qty: 14 },
    { productId: 'pain', qty: 14 },
    { productId: 'biscuits', qty: 14 },
    { productId: 'conserves', qty: 14 },
    { productId: 'eau', qty: 7 },
  ]);
  if (!r.ok) throw new Error('setup: commande impossible ' + (r as any).error);
  e.startDay();
  e.tick(35);
  for (const o of e.state.orders) if (o.status === 'arrived') e.receiveDeliveryNow(o.id);
  return e;
}

export function finishDay(e: GameEngine): void {
  let guard = 0;
  while ((e.state.phase === 'running' || e.state.phase === 'closing') && guard++ < 5000) e.tick(1);
}
