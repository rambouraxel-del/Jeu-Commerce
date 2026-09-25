import { describe, expect, it } from 'vitest';
import { computeMarketReport } from '../src/game/competition/market';
import { Rng } from '../src/game/rng';
import { createNewGame, emptyDayRecord } from '../src/game/state';

function records(revenuePerDay: number, priceIndex = 1) {
  return Array.from({ length: 14 }, (_, i) => ({ ...emptyDayRecord(i + 1, 50, 0), revenue: revenuePerDay, priceIndex, categoryRevenue: { epicerie: revenuePerDay } }));
}

describe('concurrence & rapport de marché', () => {
  it('les parts de marché somment à 100 %', () => {
    const s = createNewGame({ seed: 1 });
    const r = computeMarketReport(s, records(100000), new Rng(1), 1, 0);
    const total = r.playerShare + r.competitors.reduce((a, c) => a + c.share, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(r.competitors.length).toBeGreaterThanOrEqual(4);
    expect(r.topCategories[0].category).toBe('epicerie');
  });

  it('la part augmente avec le CA', () => {
    const a = computeMarketReport(createNewGame({ seed: 1 }), records(50000), new Rng(1), 1, 0);
    const b = computeMarketReport(createNewGame({ seed: 1 }), records(500000), new Rng(1), 1, 0);
    expect(b.playerShare).toBeGreaterThan(a.playerShare);
  });

  it('réputation, prix, offre et marketing influencent la part', () => {
    const base = () => createNewGame({ seed: 1 });
    const s1 = base();
    s1.reputation = 20;
    const s2 = base();
    s2.reputation = 90;
    const lowRep = computeMarketReport(s1, records(200000), new Rng(2), 1, 0).playerShare;
    const highRep = computeMarketReport(s2, records(200000), new Rng(2), 1, 0).playerShare;
    expect(highRep).toBeGreaterThan(lowRep);
    const cheap = computeMarketReport(base(), records(200000, 0.9), new Rng(3), 1, 0).playerShare;
    const pricey = computeMarketReport(base(), records(200000, 1.3), new Rng(3), 1, 0).playerShare;
    expect(cheap).toBeGreaterThan(pricey);
    const narrow = computeMarketReport(base(), records(200000), new Rng(4), 0.2, 0).playerShare;
    const wide = computeMarketReport(base(), records(200000), new Rng(4), 1, 10).playerShare;
    expect(wide).toBeGreaterThan(narrow);
  });

  it('un rapport est produit chaque début de mois', async () => {
    const { GameEngine } = await import('../src/game/engine');
    const e = GameEngine.newGame({ seed: 5, headless: true });
    for (let d = 0; d < 14; d++) {
      e.simulateDay();
      e.nextDay();
    }
    expect(e.state.marketReports).toHaveLength(1);
    expect(e.state.day).toBe(15);
  });
});
