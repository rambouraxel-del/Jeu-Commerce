import { describe, expect, it } from 'vitest';
import { xpForLevel } from '../src/game/constants';
import { GameEngine } from '../src/game/engine';
import { addXp, checkMilestones, makeObjective, unlocksAtLevel, updateObjectivesLive } from '../src/game/progression/progression';
import { isProductUnlocked, unlockedProducts } from '../src/game/state';
import { PRODUCTS } from '../src/data/products';

describe('progression', () => {
  it('courbe d’XP croissante et de plus en plus exigeante', () => {
    let prevGap = 0;
    for (let l = 2; l <= 20; l++) {
      const gap = xpForLevel(l) - xpForLevel(l - 1);
      expect(gap).toBeGreaterThan(prevGap);
      prevGap = gap;
    }
  });

  it('commence vraiment petit : une dizaine de produits disponibles', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    const n = unlockedProducts(e.state).length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(12);
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(50);
    expect(isProductUnlocked(e.state, 'lait')).toBe(true);
    expect(isProductUnlocked(e.state, 'smartphone')).toBe(false);
  });

  it('monter de niveau débloque catégories et produits', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    addXp(e, xpForLevel(3));
    expect(e.state.level).toBe(3);
    expect(e.state.unlockedCategories).toContain('hygiene');
    expect(isProductUnlocked(e.state, 'savon')).toBe(true);
    expect(unlocksAtLevel(10).some((t) => t.includes('Vêtements'))).toBe(true);
  });

  it('certaines catégories exigent un magasin plus grand', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    addXp(e, xpForLevel(12));
    expect(e.state.unlockedCategories).not.toContain('vetements');
    e.state.cash = 100_000_000;
    e.expandStore();
    e.expandStore();
    e.expandStore();
    expect(e.state.storeLevel).toBe(4);
    expect(e.state.unlockedCategories).toContain('vetements');
  });

  it('jalons : récompense unique', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    e.state.totalRevenue = 1_500_000;
    const cash = e.state.cash;
    checkMilestones(e);
    expect(e.state.milestones).toContain('ca_10000');
    const after = e.state.cash;
    expect(after).toBeGreaterThan(cash);
    checkMilestones(e);
    expect(e.state.cash).toBe(after);
  });

  it('objectifs courts : progression puis récompense', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    e.state.objectives = [makeObjective(e, 'placeShelves')];
    const o = e.state.objectives[0];
    const cash = e.state.cash;
    for (let i = 0; i < o.target; i++) e.buyFurniture('etagere', i * 2 < 6 ? i * 2 : 0, i * 2 < 6 ? 0 : 2, 0);
    updateObjectivesLive(e);
    expect(o.done).toBe(true);
    expect(e.state.cash).toBeGreaterThan(cash - o.target * 12000);
    expect(e.state.objectivesCompleted).toBe(1);
  });

  it('les objectifs se renouvellent chaque jour (3 actifs)', () => {
    const e = GameEngine.newGame({ seed: 1, headless: true });
    e.simulateDay();
    e.nextDay();
    expect(e.state.objectives.filter((o) => !o.done).length).toBe(3);
  });
});
