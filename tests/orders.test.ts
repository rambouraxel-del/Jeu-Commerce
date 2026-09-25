import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/constants';
import { GameEngine } from '../src/game/engine';
import { computeArrival, suggestOrder, supplierQuality, supplierUnitCost } from '../src/game/suppliers/orders';
import { shelfStock } from '../src/game/store/stock';

function engine() {
  const e = GameEngine.newGame({ seed: 5, headless: true });
  e.state.tutorial.active = false;
  return e;
}

describe('commandes', () => {
  it('débite la trésorerie et crée une commande en transit', () => {
    const e = engine();
    const cash = e.state.cash;
    const r = e.placeOrder('grossiste', [{ productId: 'lait', qty: 10 }]);
    expect(r.ok).toBe(true);
    const cost = supplierUnitCost(e.state, 'grossiste', 'lait') * 10;
    expect(e.state.cash).toBe(cash - cost);
    expect(e.state.orders[0].status).toBe('transit');
    expect(e.state.today.purchases).toBe(cost);
  });

  it('refuse commande vide, produit verrouillé, fournisseur verrouillé, trésorerie insuffisante', () => {
    const e = engine();
    expect(e.placeOrder('grossiste', []).ok).toBe(false);
    expect(e.placeOrder('grossiste', [{ productId: 'savon', qty: 1 }]).ok).toBe(false);
    expect(e.placeOrder('technova', [{ productId: 'smartphone', qty: 1 }]).ok).toBe(false);
    e.state.cash = 10;
    expect(e.placeOrder('grossiste', [{ productId: 'lait', qty: 10 }]).ok).toBe(false);
  });

  it('respecte le minimum de commande', () => {
    const e = engine();
    e.state.level = 3;
    const r = e.placeOrder('discount', [{ productId: 'lait', qty: 1 }]);
    expect(r.ok).toBe(false);
  });

  it('les commandes ne sont pas instantanées (délais fournisseurs)', () => {
    const e = engine();
    expect(computeArrival(e.state, 'grossiste')).toEqual({ day: 1, minute: BALANCE.dayStart + 30 });
    e.state.level = 3;
    expect(computeArrival(e.state, 'discount')).toEqual({ day: 2, minute: BALANCE.dayStart });
    e.state.minute = 19 * 60 + 50;
    e.state.phase = 'running';
    expect(computeArrival(e.state, 'grossiste').day).toBe(2);
  });

  it('le moins cher n’est pas le meilleur : qualité liée au fournisseur', () => {
    const e = engine();
    e.state.level = 5;
    expect(supplierUnitCost(e.state, 'discount', 'lait')).toBeLessThan(supplierUnitCost(e.state, 'grossiste', 'lait'));
    expect(supplierQuality('discount', 'lait')).toBeLessThan(supplierQuality('grossiste', 'lait'));
    expect(supplierQuality('terroir', 'lait')).toBeGreaterThan(supplierQuality('grossiste', 'lait'));
  });
});

describe('livraisons', () => {
  it('le camion arrive puis la réception range en rayon (frigo pour le frais)', () => {
    const e = engine();
    e.buyFurniture('etagere', 0, 0, 0);
    e.buyFurniture('frigo', 3, 0, 0);
    e.placeOrder('grossiste', [
      { productId: 'pates', qty: 10 },
      { productId: 'jus', qty: 5 },
      { productId: 'lait', qty: 10 },
    ]);
    e.startDay();
    e.tick(20);
    expect(e.state.orders[0].status).toBe('transit');
    e.tick(15);
    expect(e.state.orders[0].status).toBe('arrived');
    expect(e.receiveDeliveryNow(e.state.orders[0].id).ok).toBe(true);
    expect(e.state.orders[0].status).toBe('received');
    expect(shelfStock(e.state, 'lait')).toBe(10);
    expect(shelfStock(e.state, 'pates')).toBe(10);
    const frigo = e.state.furniture.find((f) => f.defId === 'frigo')!;
    expect(frigo.slots.some((s) => s.productId === 'lait')).toBe(true);
  });

  it('sans place en rayon, la marchandise va en réserve', () => {
    const e = engine();
    e.buyFurniture('etagere', 0, 0, 0);
    e.placeOrder('grossiste', [{ productId: 'pates', qty: 100 }, { productId: 'lait', qty: 5 }]);
    e.startDay();
    e.tick(35);
    e.receiveDeliveryNow(e.state.orders[0].id);
    expect(shelfStock(e.state, 'pates')).toBeGreaterThan(0);
    expect(e.state.products.pates.reserve).toBe(100 - shelfStock(e.state, 'pates'));
    expect(e.state.products.lait.reserve).toBe(5); // pas de frigo
  });

  it('coût moyen et qualité moyenne pondérés à la réception', () => {
    const e = engine();
    e.state.level = 5;
    e.buyFurniture('etagere', 0, 0, 0);
    e.placeOrder('grossiste', [{ productId: 'pates', qty: 10 }]);
    e.startDay();
    e.tick(35);
    e.receiveDeliveryNow(e.state.orders[0].id);
    const q1 = e.state.products.pates.avgQuality;
    e.placeOrder('terroir', [{ productId: 'pates', qty: 10 }]);
    e.tick(200);
    e.receiveDeliveryNow(e.state.orders[1].id);
    expect(e.state.products.pates.avgQuality).toBeGreaterThan(q1);
    expect(e.state.products.pates.avgCost).toBeGreaterThan(supplierUnitCost(e.state, 'grossiste', 'pates'));
  });

  it('l’avatar va physiquement chercher la livraison', () => {
    const e = engine();
    e.buyFurniture('etagere', 0, 0, 0);
    e.placeOrder('grossiste', [{ productId: 'pates', qty: 5 }]);
    e.startDay();
    e.tick(35);
    expect(e.requestPickup()).toBe(1);
    const x0 = e.avatar.x;
    let t = 0;
    while (e.state.orders[0].status !== 'received' && t < 60) {
      e.tickAvatar(0.1);
      t += 0.1;
    }
    expect(e.state.orders[0].status).toBe('received');
    expect(t).toBeGreaterThan(1); // le trajet prend du temps
    for (let i = 0; i < 100; i++) e.tickAvatar(0.1);
    expect(e.avatar.task.type).toBe('idle');
    expect(Math.abs(e.avatar.x - x0)).toBeLessThan(0.1);
  });

  it('les livraisons non récupérées sont déposées en réserve à la fermeture', () => {
    const e = engine();
    e.placeOrder('grossiste', [{ productId: 'pates', qty: 5 }]);
    e.simulateDay();
    expect(e.state.orders[0].status).toBe('received');
    expect(e.state.products.pates.reserve).toBe(5);
  });

  it('la suggestion propose de remplir les emplacements libres', () => {
    const e = engine();
    e.buyFurniture('etagere', 0, 0, 0);
    e.buyFurniture('frigo', 3, 0, 0);
    const sug = suggestOrder(e.state, 'grossiste');
    expect(Object.keys(sug).length).toBe(7);
    expect(sug.lait).toBeGreaterThan(0);
  });
});
