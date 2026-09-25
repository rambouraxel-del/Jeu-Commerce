import { describe, expect, it } from 'vitest';
import {
  discounted,
  margin,
  marginRate,
  perceivedRatio,
  priceAttractiveness,
  priceLabel,
  roundPrice,
} from '../src/game/economy/pricing';

describe('courbe de prix', () => {
  it('vaut 1 au prix du marché et est continue', () => {
    expect(priceAttractiveness(1)).toBeCloseTo(1, 5);
    expect(priceAttractiveness(0.999)).toBeCloseTo(priceAttractiveness(1.001), 1);
  });

  it('est strictement décroissante avec le prix', () => {
    let prev = Infinity;
    for (let r = 0.5; r <= 2.5; r += 0.05) {
      const v = priceAttractiveness(r);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it('donne un bonus plafonné sous le prix du marché', () => {
    expect(priceAttractiveness(0.8)).toBeGreaterThan(1.2);
    expect(priceAttractiveness(0.1)).toBeLessThanOrEqual(1.8);
  });

  it('pénalise fortement les prix très élevés et abusifs (pas de seuil binaire)', () => {
    const slight = priceAttractiveness(1.1);
    const high = priceAttractiveness(1.4);
    const abusive = priceAttractiveness(2);
    expect(slight).toBeGreaterThan(0.7);
    expect(slight).toBeLessThan(1);
    expect(high).toBeLessThan(0.45);
    expect(abusive).toBeLessThan(0.02);
  });

  it('une sensibilité plus forte accentue la pénalité', () => {
    expect(priceAttractiveness(1.3, 1.5)).toBeLessThan(priceAttractiveness(1.3, 0.5));
  });

  it('la qualité fait paraître le prix plus acceptable', () => {
    const good = perceivedRatio(120, 100, 90, 1);
    const bad = perceivedRatio(120, 100, 30, 1);
    expect(good).toBeLessThan(1.2);
    expect(bad).toBeGreaterThan(1.2);
  });
});

describe('marge et arrondis', () => {
  it('calcule la marge', () => {
    expect(margin(150, 100)).toBe(50);
    expect(marginRate(200, 150)).toBeCloseTo(0.25);
    expect(marginRate(0, 10)).toBe(0);
  });

  it('applique une remise en centimes entiers', () => {
    expect(discounted(199, 0.2)).toBe(159);
    expect(Number.isInteger(discounted(333, 0.3))).toBe(true);
  });

  it('arrondit aux prix psychologiques', () => {
    expect(roundPrice(115)).toBe(115);
    expect(roundPrice(282)).toBe(279);
    expect(roundPrice(2500)).toBe(2499);
  });

  it('étiquette la perception du prix', () => {
    expect(priceLabel(1).text).toBe('Prix du marché');
    expect(priceLabel(0.8).tone).toBe('good');
    expect(priceLabel(2).text).toBe('Abusif');
  });
});
