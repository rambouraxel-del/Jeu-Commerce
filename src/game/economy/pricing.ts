import { BALANCE } from '../constants';
import type { Cents } from '../types';

/**
 * Courbe prix → envie d'achat. r = prix effectif / prix du marché.
 * - r < 1 : bonus progressif et plafonné (tanh)
 * - r > 1 : pénalité exponentielle qui s'accélère (prix très élevés quasi invendables)
 * `sensitivity` module l'élasticité (profil client, réputation, qualité).
 */
export function priceAttractiveness(r: number, sensitivity = 1): number {
  if (!isFinite(r) || r <= 0) return 1 + BALANCE.priceDiscountCap;
  const s = Math.max(0.1, sensitivity);
  if (r <= 1) {
    return 1 + BALANCE.priceDiscountCap * Math.tanh((1 - r) * 2.2 * s);
  }
  const d = r - 1;
  return Math.exp(-BALANCE.priceElasticity * s * d * (1 + 2 * d));
}

/** Facteur qualité : la qualité rend l'achat plus probable (pondéré par la sensibilité du client). */
export function qualityFactor(quality: number, qualitySensitivity: number): number {
  const delta = (quality - BALANCE.qualityPivot) / 100;
  return Math.max(0.35, 1 + delta * BALANCE.qualityConversionWeight * qualitySensitivity);
}

/**
 * Une bonne qualité justifie un prix plus élevé : le ratio perçu est ajusté.
 * Une mauvaise qualité fait paraître le produit plus cher qu'il n'est.
 */
export function perceivedRatio(price: Cents, market: Cents, quality: number, qualitySensitivity: number): number {
  const base = price / Math.max(1, market);
  const adj = 1 + ((quality - BALANCE.qualityPivot) / BALANCE.qualityPriceTolerance) * qualitySensitivity;
  return base / Math.max(0.6, adj);
}

/** Tolérance tarifaire liée à la réputation : 0 → élasticité ×1,15 ; 100 → ×0,8. */
export function reputationPriceSensitivity(reputation: number): number {
  return 1.15 - 0.35 * (reputation / 100);
}

export function reputationConversion(reputation: number, sensitivity: number): number {
  return 1 + ((reputation - 50) / 100) * 0.4 * sensitivity;
}

export function margin(price: Cents, cost: Cents): Cents {
  return price - cost;
}

export function marginRate(price: Cents, cost: Cents): number {
  if (price <= 0) return 0;
  return (price - cost) / price;
}

/** Prix après remise, arrondi au centime. */
export function discounted(price: Cents, discount: number): Cents {
  return Math.max(1, Math.round(price * (1 - discount)));
}

/** Prix « psychologique » conseillé : arrondi à ,x9 ou ,x5 selon le montant. */
export function roundPrice(cents: number): Cents {
  if (cents < 200) return Math.max(5, Math.round(cents / 5) * 5);
  if (cents < 2000) return Math.round(cents / 10) * 10 - 1;
  if (cents < 10000) return Math.round(cents / 50) * 50 - 1;
  return Math.round(cents / 100) * 100 - 1;
}

/** Perception textuelle du prix pour l'interface. */
export function priceLabel(r: number): { text: string; tone: 'good' | 'neutral' | 'warn' | 'bad' } {
  if (r < 0.85) return { text: 'Très bon marché', tone: 'good' };
  if (r < 0.97) return { text: 'Bon marché', tone: 'good' };
  if (r <= 1.05) return { text: 'Prix du marché', tone: 'neutral' };
  if (r <= 1.2) return { text: 'Un peu cher', tone: 'warn' };
  if (r <= BALANCE.abusiveRatio) return { text: 'Cher', tone: 'bad' };
  return { text: 'Abusif', tone: 'bad' };
}
