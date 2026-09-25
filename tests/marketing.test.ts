import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { campaignTraffic, effectivePrice, productDiscount } from '../src/game/marketing/marketing';

function e0() {
  const e = GameEngine.newGame({ seed: 41, headless: true });
  e.state.cash = 10_000_000;
  e.state.level = 20;
  return e;
}

describe('marketing', () => {
  it('une campagne coûte, dure un temps limité et augmente la fréquentation', () => {
    const e = e0();
    const base = e.computeTraffic();
    const cash = e.state.cash;
    expect(e.launchCampaign('local_ad').ok).toBe(true);
    expect(e.state.cash).toBe(cash - 30000);
    expect(e.state.today.marketing).toBe(30000);
    expect(e.computeTraffic()).toBeGreaterThan(base * 1.2);
    expect(e.launchCampaign('local_ad').ok).toBe(false); // déjà en cours
    for (let d = 0; d < 5; d++) {
      e.simulateDay();
      e.nextDay();
    }
    expect(e.state.campaigns).toHaveLength(0);
  });

  it('les campagnes cumulées ont des rendements décroissants', () => {
    const e = e0();
    e.launchCampaign('flyers');
    const one = campaignTraffic(e.state) - 1;
    e.launchCampaign('local_ad');
    e.launchCampaign('social');
    const three = campaignTraffic(e.state) - 1;
    expect(three).toBeLessThan(0.18 + 0.25 + 0.3);
    expect(three).toBeGreaterThan(one);
  });

  it('campagne verrouillée tant que le niveau est insuffisant', () => {
    const e = GameEngine.newGame({ seed: 42, headless: true });
    e.state.cash = 10_000_000;
    expect(e.launchCampaign('tv').ok).toBe(false);
  });
});

describe('promotions', () => {
  it('remise produit, catégorie et magasin : la plus forte s’applique', () => {
    const e = e0();
    const p = e.state.products.pates.price;
    expect(e.createPromotion('product', 'pates', 0.1, 3).ok).toBe(true);
    expect(effectivePrice(e.state, 'pates')).toBe(Math.round(p * 0.9));
    e.createPromotion('category', 'epicerie', 0.2, 3);
    expect(productDiscount(e.state, 'pates')).toBe(0.2);
    expect(productDiscount(e.state, 'lait')).toBe(0);
    e.createPromotion('store', null, 0.3, 1);
    expect(productDiscount(e.state, 'lait')).toBe(0.3);
  });

  it('refuse les remises non prévues et expire après sa durée', () => {
    const e = e0();
    expect(e.createPromotion('store', null, 0.5, 3).ok).toBe(false);
    e.createPromotion('store', null, 0.2, 1);
    e.simulateDay();
    e.nextDay();
    expect(e.state.promotions).toHaveLength(0);
  });
});
