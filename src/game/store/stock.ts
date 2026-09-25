import { FURNITURE_MAP } from '../../data/furniture';
import { PRODUCT_MAP } from '../../data/products';
import { STORE_LEVELS } from '../../data/store';
import type { GameState, PlacedFurniture, ProductState } from '../types';

export function slotCapacity(state: GameState, f: PlacedFurniture, productId: string | null): number {
  const def = FURNITURE_MAP[f.defId];
  if (!def.slotVolume || !productId) return 0;
  const vol = def.slotVolume * (state.upgrades.includes('premium_shelves') ? 1.25 : 1);
  return Math.max(1, Math.floor(vol / PRODUCT_MAP[productId].volume));
}

export function canHold(f: PlacedFurniture, productId: string): boolean {
  const def = FURNITURE_MAP[f.defId];
  const prod = PRODUCT_MAP[productId];
  return def.kind === 'shelf' && !!def.categories?.includes(prod.category);
}

export function shelfStock(state: GameState, productId: string): number {
  let n = 0;
  for (const f of state.furniture) for (const s of f.slots) if (s.productId === productId) n += s.qty;
  return n;
}

export function shelfCapacity(state: GameState, productId: string): number {
  let n = 0;
  for (const f of state.furniture)
    for (const s of f.slots) if (s.productId === productId) n += slotCapacity(state, f, productId);
  return n;
}

export function totalStock(state: GameState, productId: string): number {
  return shelfStock(state, productId) + (state.products[productId]?.reserve ?? 0);
}

export function reserveCapacity(state: GameState): number {
  let cap = STORE_LEVELS[state.storeLevel - 1].reserveBase;
  if (state.upgrades.includes('reserve1')) cap += 150;
  if (state.upgrades.includes('reserve2')) cap += 500;
  if (state.upgrades.includes('reserve3')) cap += 1500;
  return cap;
}

export function reserveUsed(state: GameState): number {
  let n = 0;
  for (const id in state.products) n += state.products[id].reserve;
  return n;
}

/** Produits assignés à au moins un emplacement de rayon. */
export function assignedProducts(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const f of state.furniture) for (const s of f.slots) if (s.productId) set.add(s.productId);
  return set;
}

export function distinctInStock(state: GameState): number {
  const set = new Set<string>();
  for (const f of state.furniture) for (const s of f.slots) if (s.productId && s.qty > 0) set.add(s.productId);
  return set.size;
}

/**
 * Attribue automatiquement un emplacement libre compatible à un produit.
 * Renvoie true si un emplacement a été trouvé.
 */
export function autoAssign(state: GameState, productId: string): boolean {
  // Préférer un rayon qui a déjà la même catégorie
  const cat = PRODUCT_MAP[productId].category;
  const candidates: { f: PlacedFurniture; i: number; score: number }[] = [];
  for (const f of state.furniture) {
    if (!canHold(f, productId)) continue;
    const sameCat = f.slots.some((s) => s.productId && PRODUCT_MAP[s.productId].category === cat);
    f.slots.forEach((s, i) => {
      // même catégorie d'abord ; rayons polyvalents plutôt que spécialisés (on garde le frigo pour le frais) ;
      // on évite de remplir automatiquement les emplacements de mise en avant.
      const def = FURNITURE_MAP[f.defId];
      if (s.productId === null)
        candidates.push({ f, i, score: (sameCat ? 10 : 0) + (def.categories?.length ?? 0) * 0.4 - (def.appeal ?? 0) * 20 });
    });
  }
  if (!candidates.length) return false;
  candidates.sort((a, b) => b.score - a.score);
  candidates[0].f.slots[candidates[0].i].productId = productId;
  return true;
}

/**
 * Place `qty` unités dans les rayons (remplissage des emplacements existants,
 * puis attribution automatique d'emplacements libres si `allowAssign`).
 * Renvoie la quantité placée.
 */
export function shelveUnits(state: GameState, productId: string, qty: number, allowAssign = true, touched?: Set<number>): number {
  let left = qty;
  const fill = () => {
    for (const f of state.furniture) {
      for (const s of f.slots) {
        if (left <= 0) return;
        if (s.productId !== productId) continue;
        const cap = slotCapacity(state, f, productId);
        const room = cap - s.qty;
        if (room <= 0) continue;
        const n = Math.min(room, left);
        s.qty += n;
        left -= n;
        touched?.add(f.uid);
      }
    }
  };
  fill();
  let guard = 0;
  while (left > 0 && allowAssign && guard++ < 20) {
    if (!autoAssign(state, productId)) break;
    fill();
  }
  return qty - left;
}

/** Réassort depuis la réserve vers les rayons. Renvoie les uids de rayons remplis. */
export function restockFromReserve(state: GameState): Set<number> {
  const touched = new Set<number>();
  for (const id in state.products) {
    const ps = state.products[id];
    if (ps.reserve <= 0) continue;
    const placed = shelveUnits(state, id, ps.reserve, true, touched);
    ps.reserve -= placed;
  }
  return touched;
}

/** Ajoute des unités au stock (moyennes pondérées de coût et qualité). */
export function addToInventory(ps: ProductState, qty: number, unitCost: number, quality: number, currentStock: number): void {
  const total = currentStock + qty;
  if (total <= 0) return;
  ps.avgCost = Math.round((ps.avgCost * currentStock + unitCost * qty) / total);
  ps.avgQuality = (ps.avgQuality * currentStock + quality * qty) / total;
}

/** Retire les produits d'un rayon supprimé et les renvoie en réserve. */
export function emptyFurniture(state: GameState, f: PlacedFurniture): void {
  for (const s of f.slots) {
    if (s.productId && s.qty > 0) state.products[s.productId].reserve += s.qty;
    s.qty = 0;
    s.productId = null;
  }
}

export type StockStatus = 'ok' | 'low' | 'out' | 'over' | 'none';

export function stockStatus(state: GameState, productId: string): StockStatus {
  const ps = state.products[productId];
  const shelf = shelfStock(state, productId);
  const total = shelf + ps.reserve;
  const cap = shelfCapacity(state, productId);
  const avg = averageSales(ps);
  if (cap === 0 && total === 0) return 'none';
  if (shelf === 0) return 'out';
  if (avg > 0 && total > avg * 12 && total > 30) return 'over';
  if (shelf < Math.max(2, cap * 0.25)) return 'low';
  return 'ok';
}

export function averageSales(ps: ProductState): number {
  if (!ps.recentSales.length) return 0;
  return ps.recentSales.reduce((a, b) => a + b, 0) / ps.recentSales.length;
}
