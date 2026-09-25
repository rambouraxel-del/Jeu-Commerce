// Tests d'équilibrage : plusieurs stratégies jouées par le bot.
import { describe, expect, it } from 'vitest';
import { runBot, STRATEGIES } from '../src/game/bot/bot';
import { GameEngine } from '../src/game/engine';

const DAYS = 60;
const results: Record<string, { revenue: number; cash: number; store: number; level: number; bankrupt: boolean; cashDay20: number }> = {};

function play(key: string, seed = 101) {
  if (results[key]) return results[key];
  const e = GameEngine.newGame({ seed, headless: true });
  let cashDay20 = 0;
  runBot(e, STRATEGIES[key], DAYS, (d) => {
    if (d === 20) cashDay20 = e.state.cash;
  });
  results[key] = {
    revenue: e.state.totalRevenue,
    cash: e.state.cash,
    store: e.state.storeLevel,
    level: e.state.level,
    bankrupt: e.state.bankrupt,
    cashDay20,
  };
  return results[key];
}

describe(`équilibrage (${DAYS} jours)`, () => {
  it('une bonne gestion progresse sans que l’argent devienne trivial', () => {
    const m = play('market');
    expect(m.bankrupt).toBe(false);
    expect(m.store).toBeGreaterThanOrEqual(2);
    expect(m.level).toBeGreaterThanOrEqual(6);
    expect(m.cashDay20).toBeLessThan(1_500_000); // < 15 000 € au jour 20
    // la progression n'est pas terminée en 60 jours
    expect(m.store).toBeLessThan(5);
    expect(m.level).toBeLessThan(15);
  }, 60000);

  it('les prix abusifs sont une mauvaise stratégie', () => {
    const m = play('market');
    const a = play('abusive');
    expect(a.revenue).toBeLessThan(m.revenue * 0.3);
  }, 60000);

  it('le surstock et le sous-stock ralentissent réellement le joueur', () => {
    const m = play('market');
    expect(play('overstock').revenue).toBeLessThan(m.revenue);
    expect(play('understock').revenue).toBeLessThan(m.revenue);
  }, 90000);

  it('aucune stratégie viable ne domine totalement', () => {
    const m = play('market');
    for (const k of ['lowCost', 'premium', 'heavyMarketing', 'noMarketing']) {
      const r = play(k);
      expect(r.bankrupt).toBe(false);
      expect(r.revenue).toBeLessThan(m.revenue * 2.2);
      expect(r.revenue).toBeGreaterThan(m.revenue * 0.35);
    }
  }, 120000);
});
