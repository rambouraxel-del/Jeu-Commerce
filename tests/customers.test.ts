import { describe, expect, it } from 'vitest';
import { considerProduct, createCustomer } from '../src/game/customers/customers';
import { shelfStock } from '../src/game/store/stock';
import { finishDay, setupStore } from './helpers';

function buyRate(priceRatio: number, seed = 7, n = 400): number {
  const e = setupStore(seed);
  const s = e.state;
  const f = s.furniture.find((x) => x.slots.some((sl) => sl.productId === 'pates'))!;
  s.products.pates.price = Math.round(110 * priceRatio);
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const c = createCustomer(e)!;
    const slot = f.slots.find((sl) => sl.productId === 'pates')!;
    slot.qty = 10;
    const before = c.items.length;
    considerProduct(e, c, f, 'pates', false);
    if (c.items.length > before) bought++;
  }
  return bought / n;
}

describe('clients', () => {
  it('sont générés avec budget, sensibilités et envies', () => {
    const e = setupStore(2);
    const c = createCustomer(e)!;
    expect(c.budget).toBeGreaterThan(0);
    expect(c.priceSensitivity).toBeGreaterThan(0);
    expect(c.wants.length).toBeGreaterThanOrEqual(0);
    expect(c.skin).toBeGreaterThanOrEqual(0);
    expect(c.skin).toBeLessThan(8);
  });

  it('achètent moins quand le prix augmente (courbe progressive)', () => {
    const low = buyRate(0.8);
    const market = buyRate(1);
    const high = buyRate(1.3);
    const abusive = buyRate(2.2);
    expect(low).toBeGreaterThan(market);
    expect(market).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(abusive);
    expect(market).toBeGreaterThan(0.5);
    expect(abusive).toBeLessThan(0.05);
  });

  it('une rupture est comptabilisée et déçoit le client', () => {
    const e = setupStore(3);
    const f = e.state.furniture.find((x) => x.slots.some((sl) => sl.productId === 'pates'))!;
    f.slots.find((sl) => sl.productId === 'pates')!.qty = 0;
    const c = createCustomer(e)!;
    const sat = c.satisfaction;
    considerProduct(e, c, f, 'pates', false);
    expect(c.stockouts).toBe(1);
    expect(c.satisfaction).toBeLessThan(sat);
    expect(e.state.today.stockouts).toBe(1);
  });

  it('une vente retire le produit du rayon et encaisse le CA', () => {
    const e = setupStore(4);
    const s = e.state;
    const stock0 = shelfStock(s, 'pates');
    const cash0 = s.cash;
    const f = s.furniture.find((x) => x.slots.some((sl) => sl.productId === 'pates'))!;
    let c = createCustomer(e)!;
    let guard = 0;
    while (!c.items.length && guard++ < 50) {
      c = createCustomer(e)!;
      considerProduct(e, c, f, 'pates', false);
    }
    const qty = c.items[0].qty;
    expect(shelfStock(s, 'pates')).toBe(stock0 - qty);
    expect(s.cash).toBe(cash0 + c.items[0].price * qty);
    expect(s.today.itemsSold).toBe(qty);
  });

  it('une journée complète : clients entrent, circulent, achètent, paient et repartent', () => {
    const e = setupStore(9);
    let maxVisible = 0;
    let moved = false;
    while (e.state.phase === 'running' || e.state.phase === 'closing') {
      e.tick(1);
      maxVisible = Math.max(maxVisible, e.customers.length);
      if (e.customers.some((c) => c.phase === 'walking')) moved = true;
    }
    const t = e.state.history[e.state.history.length - 1];
    expect(t.customers).toBeGreaterThan(10);
    expect(t.buyers).toBeGreaterThan(0);
    expect(t.buyers).toBeLessThanOrEqual(t.customers);
    expect(t.revenue).toBeGreaterThan(0);
    expect(maxVisible).toBeGreaterThan(0);
    expect(moved).toBe(true);
    expect(e.customers).toHaveLength(0);
  });

  it('les clients contournent les meubles (jamais sur une case bloquée en marchant)', () => {
    const e = setupStore(10);
    let violations = 0;
    for (let i = 0; i < 600 && e.state.phase === 'running'; i++) {
      e.tick(0.5);
      for (const c of e.customers) {
        if (c.phase !== 'walking' && c.phase !== 'toCheckout') continue;
        const cx = Math.floor(c.x);
        const cy = Math.floor(c.y);
        if (cy >= 0 && cy < e.grid.h && !e.grid.isWalkable(cx, cy)) violations++;
      }
    }
    expect(violations).toBe(0);
  });

  it('le nombre de clients affichés est limité (les autres sont simulés)', () => {
    const e = setupStore(11);
    e.expectedToday = 5000;
    e.tick(240);
    expect(e.customers.length).toBeLessThanOrEqual(14);
    expect(e.state.today.customers).toBeGreaterThan(100);
    finishDay(e);
  });
});
