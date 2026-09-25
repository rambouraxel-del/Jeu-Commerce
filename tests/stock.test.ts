import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { averageSales, restockFromReserve, shelfCapacity, shelfStock, shelveUnits, slotCapacity, stockStatus } from '../src/game/store/stock';

describe('stock', () => {
  it('capacité des emplacements selon le volume du produit', () => {
    const e = GameEngine.newGame({ seed: 71, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    const f = e.state.furniture[0];
    expect(slotCapacity(e.state, f, 'pates')).toBe(14);
    expect(slotCapacity(e.state, f, 'eau')).toBe(7);
    e.state.upgrades.push('premium_shelves');
    expect(slotCapacity(e.state, f, 'pates')).toBe(17);
  });

  it('remplit les rayons puis attribue des emplacements libres', () => {
    const e = GameEngine.newGame({ seed: 72, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    const placed = shelveUnits(e.state, 'pates', 20);
    expect(placed).toBe(20);
    expect(shelfCapacity(e.state, 'pates')).toBe(28);
    expect(shelfStock(e.state, 'pates')).toBe(20);
  });

  it('réassort depuis la réserve', () => {
    const e = GameEngine.newGame({ seed: 73, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    e.assignSlot(e.state.furniture[0].uid, 0, 'riz');
    e.state.products.riz.reserve = 30;
    restockFromReserve(e.state);
    expect(shelfStock(e.state, 'riz')).toBeGreaterThanOrEqual(14);
    expect(e.state.products.riz.reserve + shelfStock(e.state, 'riz')).toBe(30);
  });

  it('statuts OK / Faible / Rupture / Surstock', () => {
    const e = GameEngine.newGame({ seed: 74, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    const f = e.state.furniture[0];
    e.assignSlot(f.uid, 0, 'pates');
    expect(stockStatus(e.state, 'pates')).toBe('out');
    f.slots[0].qty = 2;
    expect(stockStatus(e.state, 'pates')).toBe('low');
    f.slots[0].qty = 14;
    expect(stockStatus(e.state, 'pates')).toBe('ok');
    e.state.products.pates.recentSales = [2, 2, 2];
    e.state.products.pates.reserve = 200;
    expect(stockStatus(e.state, 'pates')).toBe('over');
    expect(averageSales(e.state.products.pates)).toBe(2);
  });

  it('le rayon se vide visuellement à mesure des ventes (quantité par emplacement)', () => {
    const e = GameEngine.newGame({ seed: 75, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    shelveUnits(e.state, 'pates', 14);
    const slot = e.state.furniture[0].slots.find((s) => s.productId === 'pates')!;
    expect(slot.qty).toBe(14);
    slot.qty -= 10;
    expect(shelfStock(e.state, 'pates')).toBe(4);
  });

  it('changer le produit d’un emplacement renvoie l’ancien en réserve', () => {
    const e = GameEngine.newGame({ seed: 76, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    const f = e.state.furniture[0];
    e.assignSlot(f.uid, 0, 'pates');
    f.slots[0].qty = 9;
    expect(e.assignSlot(f.uid, 0, 'riz').ok).toBe(true);
    expect(e.state.products.pates.reserve).toBe(9);
    expect(e.assignSlot(f.uid, 1, 'lait').ok).toBe(false); // le lait va au frigo
  });
});
