import { CATEGORY_MAP } from '../../data/categories';
import { SEGMENTS, SEGMENT_MAP, SKIN_VARIANTS, type SegmentDef } from '../../data/customers';
import { FURNITURE_MAP } from '../../data/furniture';
import { PRODUCT_MAP } from '../../data/products';
import { calendarCategoryDemand, calendarPromoSensitivity } from '../calendar/calendar';
import { BALANCE } from '../constants';
import {
  perceivedRatio,
  priceAttractiveness,
  qualityFactor,
  reputationConversion,
  reputationPriceSensitivity,
} from '../economy/pricing';
import type { GameEngine } from '../engine';
import { campaignSegmentBoost, effectivePrice, productDiscount } from '../marketing/marketing';
import { onItemsSold } from '../progression/progression';
import { geometry, levelDef } from '../store/layout';
import type { CategoryId, Customer, CustomerWant, GameState, PlacedFurniture } from '../types';

export function segmentWeight(state: GameState, seg: SegmentDef, promoActive: boolean): number {
  let w = seg.weight;
  if (seg.upscale > 0) {
    const repF = Math.pow(Math.max(0.05, state.reputation / 55), seg.upscale);
    const storeF = Math.pow(state.storeLevel / 3, seg.upscale);
    w *= repF * storeF;
  }
  w *= campaignSegmentBoost(state, seg.id);
  if (seg.id === 'promo') {
    if (promoActive) w *= 1.6;
    w *= calendarPromoSensitivity(state.day);
  }
  return w;
}

/** Catégories effectivement proposées (au moins un produit assigné en rayon). */
export function carriedByCategory(state: GameState): Map<CategoryId, { productId: string; furniture: PlacedFurniture[] }[]> {
  const map = new Map<CategoryId, { productId: string; furniture: PlacedFurniture[] }[]>();
  const byProduct = new Map<string, PlacedFurniture[]>();
  for (const f of state.furniture) {
    for (const s of f.slots) {
      if (!s.productId) continue;
      const arr = byProduct.get(s.productId) ?? [];
      if (!arr.includes(f)) arr.push(f);
      byProduct.set(s.productId, arr);
    }
  }
  for (const [pid, furniture] of byProduct) {
    const cat = PRODUCT_MAP[pid].category;
    const list = map.get(cat) ?? [];
    list.push({ productId: pid, furniture });
    map.set(cat, list);
  }
  return map;
}

function categoryModifier(state: GameState, cat: CategoryId): number {
  let m = calendarCategoryDemand(state.day, cat);
  for (const mod of state.modifiers) if (mod.type === 'categoryDemand' && mod.target === cat) m *= 1 + mod.value;
  return m;
}

function productModifier(state: GameState, pid: string): number {
  let m = 1;
  for (const mod of state.modifiers) if (mod.type === 'productDemand' && mod.target === pid) m *= 1 + mod.value;
  return m;
}

export function createCustomer(engine: GameEngine): Customer | null {
  const s = engine.state;
  const rng = engine.rng;
  const promoActive = s.promotions.length > 0;
  const seg = rng.weighted(SEGMENTS, (x) => segmentWeight(s, x, promoActive));
  if (!seg) return null;
  const geo = geometry(s.storeLevel);
  const levelBudget = 1 + 0.18 * (s.storeLevel - 1);
  const budget = Math.round(seg.budget * levelBudget * Math.exp(rng.gauss() * 0.35));
  const c: Customer = {
    id: engine.nextCustomerId++,
    segment: seg.id,
    skin: seg.skin,
    variant: rng.int(0, SKIN_VARIANTS - 1),
    x: geo.doorX + 0.5 + rng.range(-1.5, 1.5),
    y: geo.h + 1.6,
    path: [],
    phase: 'entering',
    timer: 0,
    budget,
    spent: 0,
    items: [],
    wants: [],
    wantIndex: 0,
    priceSensitivity: seg.priceSensitivity * rng.range(0.85, 1.15),
    qualitySensitivity: seg.qualitySensitivity * rng.range(0.85, 1.15),
    reputationSensitivity: seg.reputationSensitivity,
    buyProbability: seg.buyProbability,
    satisfaction: BALANCE.satisfactionStart,
    checkout: -1,
    waited: 0,
    facing: 1,
    walkPhase: rng.next() * 10,
    missedWants: 0,
    stockouts: 0,
    speed: BALANCE.customerSpeed * rng.range(0.85, 1.15),
  };
  planWants(engine, c, seg);
  return c;
}

/** Choisit les envies du client (produits/rayons) en fonction de son profil et de l'offre. */
export function planWants(engine: GameEngine, c: Customer, seg: SegmentDef): void {
  const s = engine.state;
  const rng = engine.rng;
  const carried = carriedByCategory(s);
  const basketMult = (1 + 0.1 * (s.storeLevel - 1)) * (s.upgrades.includes('baskets') ? 1.15 : 1);
  const count = Math.max(1, Math.round(rng.int(seg.basket[0], seg.basket[1]) * basketMult));
  const unlocked = s.unlockedCategories;
  const carriedCats = [...carried.keys()];
  const catWeight = (cat: CategoryId) =>
    (seg.prefs[cat] ?? 0.3) * CATEGORY_MAP[cat].baseWeight * categoryModifier(s, cat);
  const chosen = new Map<string, CustomerWant>();
  const geo = geometry(s.storeLevel);
  for (let i = 0; i < count; i++) {
    const inStore = carriedCats.length > 0 && rng.chance(BALANCE.wantInStoreChance);
    const cat = rng.weighted(inStore ? carriedCats : unlocked, catWeight);
    if (!cat) continue;
    const options = carried.get(cat);
    if (!options || !options.length) {
      c.missedWants++;
      continue;
    }
    const opt = rng.weighted(options, (o) => {
      const def = PRODUCT_MAP[o.productId];
      const ps = s.products[o.productId];
      const d = productDiscount(s, o.productId);
      const promo = d > 0 ? 1 + BALANCE.promoDemandBoost * d * seg.promoSensitivity * calendarPromoSensitivity(s.day) : 1;
      return def.demand * ps.popularity * productModifier(s, o.productId) * promo;
    });
    if (!opt || chosen.has(opt.productId)) continue;
    // rayon : de préférence un emplacement avec du stock, le plus proche de l'entrée
    let best: PlacedFurniture | null = null;
    let bestScore = Infinity;
    for (const f of opt.furniture) {
      const stock = f.slots.some((sl) => sl.productId === opt.productId && sl.qty > 0);
      const d = Math.hypot(f.x - geo.doorX, f.y - geo.h);
      const score = d + (stock ? 0 : 100);
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (best) chosen.set(opt.productId, { productId: opt.productId, furnitureUid: best.uid });
  }
  // ordre de visite : plus proche voisin depuis l'entrée
  const wants = [...chosen.values()];
  const ordered: CustomerWant[] = [];
  let px = geo.doorX;
  let py = geo.h - 1;
  const furnitureByUid = new Map(s.furniture.map((f) => [f.uid, f]));
  while (wants.length) {
    let bi = 0;
    let bd = Infinity;
    wants.forEach((w, i) => {
      const f = furnitureByUid.get(w.furnitureUid)!;
      const d = Math.abs(f.x - px) + Math.abs(f.y - py);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const w = wants.splice(bi, 1)[0];
    // regrouper les envies d'un même rayon
    const same = wants.filter((x) => x.furnitureUid === w.furnitureUid);
    ordered.push(w, ...same);
    for (const x of same) wants.splice(wants.indexOf(x), 1);
    const f = furnitureByUid.get(w.furnitureUid)!;
    px = f.x;
    py = f.y;
  }
  c.wants = ordered;
  c.wantIndex = 0;
}

export type Reaction = { text: string; mood: 'good' | 'bad' | 'neutral' } | null;

/**
 * Le client examine un produit d'un rayon et décide d'acheter ou non.
 * Renvoie une éventuelle réaction.
 */
export function considerProduct(engine: GameEngine, c: Customer, f: PlacedFurniture, productId: string, impulse: boolean): Reaction {
  const s = engine.state;
  const rng = engine.rng;
  const def = PRODUCT_MAP[productId];
  const ps = s.products[productId];
  const slot = f.slots.find((sl) => sl.productId === productId && sl.qty > 0);
  if (!slot) {
    if (impulse) return null;
    c.stockouts++;
    c.satisfaction -= 7;
    ps.stockoutsToday++;
    s.today.stockouts++;
    if (!s.today.stockoutProducts.includes(productId)) s.today.stockoutProducts.push(productId);
    return rng.chance(0.4) ? { text: 'Plus en stock…', mood: 'bad' } : null;
  }
  const price = effectivePrice(s, productId);
  const discount = productDiscount(s, productId);
  const r = perceivedRatio(price, def.marketPrice, ps.avgQuality, c.qualitySensitivity);
  const rawRatio = price / def.marketPrice;
  const sens = c.priceSensitivity * reputationPriceSensitivity(s.reputation);
  const pa = priceAttractiveness(r, sens);
  const qf = qualityFactor(ps.avgQuality, c.qualitySensitivity);
  const rf = reputationConversion(s.reputation, c.reputationSensitivity);
  const fdef = FURNITURE_MAP[f.defId];
  const appeal = 1 + (fdef.appeal ?? 0) + (s.upgrades.includes('premium_shelves') ? 0.05 : 0);
  const seg = SEGMENT_MAP[c.segment];
  const promoBoost =
    discount > 0
      ? 1 + BALANCE.promoDemandBoost * discount * seg.promoSensitivity * calendarPromoSensitivity(s.day) * (s.upgrades.includes('promo_space') ? 1.3 : 1)
      : 1;
  const base = impulse
    ? BALANCE.impulseChance * def.demand * categoryModifier(s, def.category) * (fdef.appeal ? 1 + fdef.appeal * 2 : 1)
    : BALANCE.baseConversion;
  const p = Math.min(0.97, base * c.buyProbability * pa * qf * rf * appeal * promoBoost);

  const remaining = c.budget - c.spent;
  if (price > remaining) {
    if (impulse) return null;
    c.satisfaction -= 1.5;
    return rng.chance(0.25) ? { text: 'Trop cher pour moi', mood: 'bad' } : null;
  }
  if (!rng.chance(p)) {
    if (impulse) return null;
    if (rawRatio > BALANCE.abusiveRatio) {
      c.satisfaction -= 15;
      return rng.chance(0.5) ? { text: 'Prix abusif !', mood: 'bad' } : null;
    }
    if (r > 1.12) {
      c.satisfaction -= 2 + 14 * (r - 1);
      return rng.chance(0.35) ? { text: 'Trop cher', mood: 'bad' } : null;
    }
    return null;
  }
  // Achat
  let qty = 1;
  if (price < 400 && rng.chance(0.28 * pa)) qty = 2;
  qty = Math.min(qty, slot.qty, Math.max(1, Math.floor(remaining / price)));
  slot.qty -= qty;
  const amount = price * qty;
  c.spent += amount;
  c.items.push({ productId, qty, price });
  recordSale(engine, productId, qty, price, f);

  // Ressenti
  let reaction: Reaction = null;
  if (r < 0.93) {
    c.satisfaction += 2.5;
    if (rng.chance(0.12)) reaction = { text: discount > 0 ? 'Super promo !' : 'Bonne affaire !', mood: 'good' };
  } else if (r > 1.15) {
    c.satisfaction -= 3 * (r - 1) * 10 * 0.3;
  } else {
    c.satisfaction += 0.8;
  }
  // La qualité pèse sur la satisfaction de façon continue.
  c.satisfaction += ((ps.avgQuality - BALANCE.qualityPivot) / 100) * 6 * c.qualitySensitivity;
  if (ps.avgQuality >= 80) {
    c.satisfaction += 0.5 * c.qualitySensitivity;
    if (!reaction && rng.chance(0.08)) reaction = { text: "J'adore ce produit !", mood: 'good' };
  } else if (ps.avgQuality < 40) {
    c.satisfaction -= 1 * c.qualitySensitivity;
    if (!reaction && rng.chance(0.1)) reaction = { text: 'Pas terrible…', mood: 'bad' };
  }
  return reaction;
}

/** Comptabilise une vente (CA au moment où le client prend l'article). */
export function recordSale(engine: GameEngine, productId: string, qty: number, price: number, f: PlacedFurniture | null): void {
  const s = engine.state;
  const def = PRODUCT_MAP[productId];
  const ps = s.products[productId];
  const amount = price * qty;
  const cost = ps.avgCost * qty;
  s.today.revenue += amount;
  s.today.cogs += cost;
  s.today.itemsSold += qty;
  s.today.categoryRevenue[def.category] = (s.today.categoryRevenue[def.category] ?? 0) + amount;
  s.today.productUnits[productId] = (s.today.productUnits[productId] ?? 0) + qty;
  engine.marketValueToday += def.marketPrice * qty;
  s.cash += amount;
  s.totalRevenue += amount;
  ps.soldToday += qty;
  ps.soldTotal += qty;
  ps.popularity = Math.min(1.6, ps.popularity + BALANCE.popularityGain * qty);
  s.lifetime.itemsSold += qty;
  s.lifetime.categorySales[def.category] = (s.lifetime.categorySales[def.category] ?? 0) + qty;
  engine.addMarginXp(amount - cost);
  onItemsSold(engine, def.category, qty);
  if (f) engine.emit({ type: 'sale', x: f.x + 0.5, y: f.y + 0.5, amount, productId });
}

/** Satisfaction finale d'un client au moment où il quitte le magasin. */
export function finalizeSatisfaction(engine: GameEngine, c: Customer): number {
  const s = engine.state;
  let sat = c.satisfaction;
  sat += engine.ambianceBonus;
  if (s.upgrades.includes('music')) sat += 3;
  if (s.upgrades.includes('aircon')) sat += engine.isSummer ? 6 : 3;
  sat -= c.missedWants * 3;
  if (c.waited > BALANCE.queuePatience) sat -= (c.waited - BALANCE.queuePatience) * 0.8;
  if (c.items.length === 0 && c.stockouts === 0 && c.wants.length === 0) sat -= 6; // rien trouvé d'intéressant
  if (c.items.length === 0 && c.wants.length > 0) sat -= 8; // visite déçue : reparti les mains vides
  // variété
  const def = levelDef(s.storeLevel);
  sat += Math.min(4, (engine.distinctCache / def.expectedVariety) * 4) - 2;
  return Math.max(0, Math.min(100, sat));
}
