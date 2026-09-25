import { describe, expect, it } from 'vitest';
import { roundPrice } from '../src/game/economy/pricing';
import { PRODUCT_MAP } from '../src/data/products';
import { setupStore } from './helpers';
import { Bot, STRATEGIES } from '../src/game/bot/bot';

function repAfter(priceRatio: number, days: number, seed = 31): number {
  const e = setupStore(seed);
  const bot = new Bot(e, { ...STRATEGIES.market, priceRatio, marketing: 0 });
  for (const id in e.state.products) e.state.products[id].price = roundPrice(PRODUCT_MAP[id].marketPrice * priceRatio);
  for (let d = 0; d < days; d++) bot.playDay();
  return e.state.reputation;
}

describe('réputation', () => {
  it('reste dans [0, 100] et évolue lentement', () => {
    const e = setupStore(30);
    const bot = new Bot(e, STRATEGIES.market);
    let prev = e.state.reputation;
    for (let d = 0; d < 10; d++) {
      bot.playDay();
      const r = e.state.reputation;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
      expect(Math.abs(r - prev)).toBeLessThan(6); // lente à construire (dérive ≤ 2,5/j + bonus ponctuels)
      prev = r;
    }
  });

  it('des prix abusifs font baisser la réputation, des prix justes la font monter', () => {
    const fair = repAfter(1, 15);
    const abusive = repAfter(2, 15);
    expect(fair).toBeGreaterThan(30);
    expect(abusive).toBeLessThan(30);
    expect(fair).toBeGreaterThan(abusive + 8);
  });
});
