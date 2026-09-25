import { describe, expect, it } from 'vitest';
import { dailyCharges } from '../src/game/economy/finance';
import { GameEngine } from '../src/game/engine';
import { finishDay, setupStore } from './helpers';

describe('économie & finances', () => {
  it('tous les montants restent des centimes entiers', () => {
    const e = setupStore(21);
    finishDay(e);
    const t = e.state.history[0];
    for (const k of ['revenue', 'cogs', 'charges', 'taxes', 'profit', 'purchases', 'investments'] as const) {
      expect(Number.isInteger(t[k])).toBe(true);
    }
    expect(Number.isInteger(e.state.cash)).toBe(true);
  });

  it('résultat = CA − coût des ventes − marketing − charges − taxes', () => {
    const e = setupStore(22);
    finishDay(e);
    const t = e.state.history[0];
    expect(t.profit).toBe(t.revenue - t.cogs - t.marketing - t.charges - t.taxes);
  });

  it('la trésorerie est cohérente avec les flux de la journée', () => {
    const e = GameEngine.newGame({ seed: 23, headless: true });
    e.state.objectives = [];
    e.buyFurniture('etagere', 0, 0, 0);
    e.placeOrder('grossiste', [{ productId: 'pates', qty: 14 }]);
    const start = e.state.today.cashEnd; // trésorerie en début de journée
    e.startDay();
    e.tick(40);
    for (const o of e.state.orders) if (o.status === 'arrived') e.receiveDeliveryNow(o.id);
    e.state.milestones = ['first_sale', 'ca_1000', 'first_profit_day', 'customers_1000'];
    finishDay(e);
    const t = e.state.history[0];
    const expected = start + t.revenue - t.purchases - t.investments - t.marketing - t.charges - t.taxes;
    expect(e.state.cash).toBe(expected);
  });

  it('les charges augmentent avec la taille du magasin et les équipements', () => {
    const e = GameEngine.newGame({ seed: 24, headless: true });
    const c1 = dailyCharges(e.state, 0).total;
    e.buyFurniture('frigo', 0, 0, 0);
    const c2 = dailyCharges(e.state, 0).total;
    expect(c2).toBeGreaterThan(c1);
    e.state.storeLevel = 3;
    expect(dailyCharges(e.state, 0).total).toBeGreaterThan(c2);
    expect(dailyCharges(e.state, 100000).taxes).toBe(3000);
  });

  it('pas de prêt : impossible d’acheter sans trésorerie', () => {
    const e = GameEngine.newGame({ seed: 25, headless: true });
    e.state.cash = 0;
    expect(e.buyFurniture('etagere', 0, 0, 0).ok).toBe(false);
    expect(e.placeOrder('grossiste', [{ productId: 'lait', qty: 1 }]).ok).toBe(false);
    expect(e.launchCampaign('flyers').ok).toBe(false);
  });

  it('la faillite n’arrive qu’après une longue période très négative', () => {
    const e = GameEngine.newGame({ seed: 26, headless: true });
    e.state.cash = -1_000_000;
    for (let d = 0; d < 11; d++) {
      e.simulateDay();
      expect(e.state.bankrupt).toBe(false);
      e.nextDay();
    }
    e.simulateDay();
    expect(e.state.bankrupt).toBe(true);
  });

  it('se redresser remet le compteur de faillite à zéro', () => {
    const e = GameEngine.newGame({ seed: 27, headless: true });
    e.state.cash = -1_000_000;
    e.simulateDay();
    e.nextDay();
    expect(e.state.negativeDays).toBe(1);
    e.state.cash = 100_000;
    e.simulateDay();
    expect(e.state.negativeDays).toBe(0);
  });
});
