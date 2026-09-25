import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { buildGrid, expansionOffset, geometry, reachableFromDoor, validatePlacement } from '../src/game/store/layout';
import type { PlacedFurniture } from '../src/game/types';

const shelf = (uid: number, x: number, y: number, rot: 0 | 1 = 0): PlacedFurniture => ({ uid, defId: 'etagere', x, y, rot, slots: [] });

describe('mode aménagement : validation de placement', () => {
  it('refuse hors du magasin', () => {
    expect(validatePlacement(1, [], { defId: 'etagere', x: 6, y: 0, rot: 0 })).toBe('outside');
    expect(validatePlacement(1, [], { defId: 'etagere', x: -1, y: 0, rot: 0 })).toBe('outside');
  });

  it('refuse la zone d’accueil fixe (entrée et caisses)', () => {
    const g = geometry(1);
    expect(validatePlacement(1, [], { defId: 'plante', x: 0, y: g.h - 2, rot: 0 })).toBe('fixedZone');
    expect(validatePlacement(1, [], { defId: 'plante', x: g.doorX, y: g.h - 1, rot: 0 })).toBe('fixedZone');
  });

  it('refuse les chevauchements', () => {
    const f = [shelf(1, 1, 1)];
    expect(validatePlacement(1, f, { defId: 'etagere', x: 2, y: 1, rot: 0 })).toBe('overlap');
    expect(validatePlacement(1, f, { defId: 'etagere', x: 3, y: 1, rot: 0 })).toBeNull();
  });

  it('refuse un placement qui rendrait un rayon inaccessible', () => {
    // rayon dans le coin (0,0) entouré : bloquer ses accès doit être refusé
    const f = [shelf(1, 0, 0), { uid: 2, defId: 'plante', x: 2, y: 0, rot: 0 as const, slots: [] }];
    expect(validatePlacement(1, f, { defId: 'etagere', x: 0, y: 1, rot: 0 })).toBe('blocksAccess');
  });

  it('refuse un rayon lui-même inaccessible', () => {
    const f = [shelf(1, 1, 0), { uid: 3, defId: 'plante', x: 0, y: 1, rot: 0 as const, slots: [] }];
    // la case (0,0) est enfermée : un rayon 1×1 là serait inaccessible
    expect(validatePlacement(1, f, { defId: 'panier_pain', x: 0, y: 0, rot: 0 })).toBe('noAccess');
  });

  it('la zone fixe reste toujours accessible depuis la porte', () => {
    const g = geometry(1);
    const grid = buildGrid(1, [shelf(1, 0, 3), shelf(2, 2, 3), shelf(3, 4, 3)]);
    const reach = reachableFromDoor(1, grid);
    for (let x = 0; x < g.w; x++) expect(reach[(g.h - 2) * g.w + x]).toBe(1);
  });

  it('pivote les meubles (w/h inversés)', () => {
    expect(validatePlacement(1, [], { defId: 'etagere', x: 6, y: 0, rot: 1 })).toBeNull();
  });
});

describe('mode aménagement : actions du moteur', () => {
  it('achète, déplace et revend un meuble', () => {
    const e = GameEngine.newGame({ seed: 3, headless: true });
    e.state.objectives = []; // pas de récompense d'objectif pendant le test
    const cash0 = e.state.cash;
    const r = e.buyFurniture('etagere', 1, 1, 0);
    expect(r.ok).toBe(true);
    expect(e.state.cash).toBe(cash0 - 12000);
    const uid = e.state.furniture[0].uid;
    expect(e.moveFurniture(uid, 3, 2, 1).ok).toBe(true);
    expect(e.state.furniture[0]).toMatchObject({ x: 3, y: 2, rot: 1 });
    const sell = e.sellFurniture(uid);
    expect(sell.ok).toBe(true);
    expect(e.state.cash).toBe(cash0 - 12000 + 6000);
    expect(e.state.furniture).toHaveLength(0);
  });

  it('refuse un meuble non débloqué ou trop cher', () => {
    const e = GameEngine.newGame({ seed: 3, headless: true });
    expect(e.buyFurniture('vitrine', 1, 1, 0).ok).toBe(false);
    e.state.cash = 100;
    expect(e.buyFurniture('etagere', 1, 1, 0).ok).toBe(false);
  });

  it('revendre un rayon renvoie ses produits en réserve', () => {
    const e = GameEngine.newGame({ seed: 3, headless: true });
    e.buyFurniture('etagere', 1, 1, 0);
    const f = e.state.furniture[0];
    e.state.products.pates.reserve = 10;
    e.assignSlot(f.uid, 0, 'pates');
    expect(f.slots[0].qty).toBe(10);
    e.sellFurniture(f.uid);
    expect(e.state.products.pates.reserve).toBe(10);
  });

  it('l’agrandissement conserve les meubles (translatés) et reste valide', () => {
    const e = GameEngine.newGame({ seed: 3, headless: true });
    e.buyFurniture('etagere', 0, 0, 0);
    e.buyFurniture('frigo', 3, 2, 0);
    e.state.cash = 10_000_000;
    e.state.level = 10;
    const before = e.state.furniture.map((f) => ({ ...f }));
    expect(e.expandStore().ok).toBe(true);
    const { dx, dy } = expansionOffset(1, 2);
    e.state.furniture.forEach((f, i) => {
      expect(f.x).toBe(before[i].x + dx);
      expect(f.y).toBe(before[i].y + dy);
      expect(validatePlacement(2, e.state.furniture, f, f.uid)).toBeNull();
    });
    expect(e.state.storeLevel).toBe(2);
  });

  it('l’agrandissement exige niveau, argent et magasin fermé', () => {
    const e = GameEngine.newGame({ seed: 3, headless: true });
    expect(e.canExpand().ok).toBe(false);
    e.state.cash = 10_000_000;
    expect(e.canExpand().ok).toBe(false); // niveau insuffisant
    e.state.level = 5;
    expect(e.canExpand().ok).toBe(true);
    e.startDay();
    expect(e.canExpand().ok).toBe(false);
  });
});
