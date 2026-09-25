import { CAMPAIGN_MAP } from '../../data/marketing';
import { PRODUCT_MAP } from '../../data/products';
import { discounted } from '../economy/pricing';
import type { GameState, Promotion } from '../types';

/** Remise applicable à un produit (la plus forte des promotions actives). */
export function productDiscount(state: GameState, productId: string): number {
  const cat = PRODUCT_MAP[productId].category;
  let d = 0;
  for (const p of state.promotions) {
    if (
      p.scope === 'store' ||
      (p.scope === 'category' && p.target === cat) ||
      (p.scope === 'product' && p.target === productId)
    ) {
      d = Math.max(d, p.discount);
    }
  }
  return d;
}

export function effectivePrice(state: GameState, productId: string): number {
  const ps = state.products[productId];
  const d = productDiscount(state, productId);
  return d > 0 ? discounted(ps.price, d) : ps.price;
}

/** Multiplicateur de fréquentation apporté par les campagnes (rendements décroissants). */
export function campaignTraffic(state: GameState): number {
  let sum = 0;
  for (const c of state.campaigns) sum += CAMPAIGN_MAP[c.id]?.traffic ?? 0;
  return 1 + sum / (1 + 0.35 * sum);
}

/** Bonus de poids par profil client (campagnes ciblées). */
export function campaignSegmentBoost(state: GameState, segment: string): number {
  let b = 1;
  for (const c of state.campaigns) {
    const def = CAMPAIGN_MAP[c.id];
    if (def && def.segments.includes(segment)) b += def.traffic * 0.8;
  }
  return b;
}

export function promotionLabel(p: Promotion): string {
  const pct = Math.round(p.discount * 100);
  if (p.scope === 'store') return `-${pct} % sur tout le magasin`;
  if (p.scope === 'category') return `-${pct} % catégorie`;
  return `-${pct} % produit`;
}
