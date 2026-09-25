import { PRODUCT_MAP } from '../../data/products';
import { SUPPLIER_MAP, SUPPLIERS } from '../../data/suppliers';
import { BALANCE } from '../constants';
import { isProductUnlocked } from '../state';
import { averageSales, canHold, shelfCapacity, shelfStock, slotCapacity } from '../store/stock';
import type { GameState, SupplierDef } from '../types';

export function isSupplierUnlocked(state: GameState, s: SupplierDef): boolean {
  return state.level >= s.unlockLevel;
}

export function availableSuppliers(state: GameState): SupplierDef[] {
  return SUPPLIERS.filter((s) => isSupplierUnlocked(state, s));
}

export function supplierCatalog(state: GameState, supplierId: string, includeLocked = false): string[] {
  const s = SUPPLIER_MAP[supplierId];
  const out: string[] = [];
  for (const id in PRODUCT_MAP) {
    const p = PRODUCT_MAP[id];
    if (!s.categories.includes(p.category)) continue;
    if (!includeLocked && !isProductUnlocked(state, id)) continue;
    out.push(id);
  }
  return out;
}

/** Petite variation déterministe de qualité par couple fournisseur/produit. */
function hashOffset(a: string, b: string): number {
  let h = 2166136261;
  const s = a + '|' + b;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 11) - 5;
}

export function supplierPriceFactor(state: GameState, supplierId: string): number {
  let f = SUPPLIER_MAP[supplierId].priceFactor;
  for (const m of state.modifiers) {
    if (m.target !== supplierId) continue;
    if (m.type === 'supplierPrice') f *= 1 + m.value;
    if (m.type === 'supplierDiscount') f *= 1 - m.value;
  }
  return f;
}

export function supplierUnitCost(state: GameState, supplierId: string, productId: string): number {
  return Math.max(1, Math.round(PRODUCT_MAP[productId].baseCost * supplierPriceFactor(state, supplierId)));
}

export function supplierQuality(supplierId: string, productId: string): number {
  const q = SUPPLIER_MAP[supplierId].quality + hashOffset(supplierId, productId);
  return Math.max(5, Math.min(100, q));
}

/** Calcule le moment d'arrivée d'une commande passée maintenant. */
export function computeArrival(state: GameState, supplierId: string): { day: number; minute: number } {
  const s = SUPPLIER_MAP[supplierId];
  const afterClose = state.phase === 'report' || state.phase === 'closing';
  if (s.delayDays > 0) {
    return { day: state.day + s.delayDays, minute: BALANCE.dayStart };
  }
  if (afterClose) {
    return { day: state.day + 1, minute: BALANCE.dayStart + s.delayMinutes };
  }
  const now = Math.max(state.minute, BALANCE.dayStart);
  const arrival = now + s.delayMinutes;
  if (arrival > BALANCE.closeTime - 30) {
    return { day: state.day + 1, minute: BALANCE.dayStart };
  }
  return { day: state.day, minute: arrival };
}

export function delayLabel(s: SupplierDef): string {
  if (s.delayDays === 1) return 'Lendemain matin';
  if (s.delayDays > 1) return `${s.delayDays} jours`;
  if (s.delayMinutes < 60) return `${s.delayMinutes} min`;
  const h = s.delayMinutes / 60;
  return `${h.toString().replace('.', ',')} h`;
}

/**
 * Suggestion de commande : complète les rayons existants (+ un peu de marge
 * selon les ventes moyennes) puis propose des produits pour les emplacements libres.
 */
export function suggestOrder(state: GameState, supplierId: string): Record<string, number> {
  const catalog = supplierCatalog(state, supplierId);
  const pending = new Map<string, number>();
  for (const o of state.orders)
    if (o.status !== 'received') for (const l of o.lines) pending.set(l.productId, (pending.get(l.productId) ?? 0) + l.qty);
  const out: Record<string, number> = {};
  const assigned = new Set<string>();
  for (const f of state.furniture) for (const s of f.slots) if (s.productId) assigned.add(s.productId);
  // 1) produits déjà en rayon
  for (const pid of catalog) {
    if (!assigned.has(pid)) continue;
    const cap = shelfCapacity(state, pid);
    const have = shelfStock(state, pid) + state.products[pid].reserve + (pending.get(pid) ?? 0);
    const need = cap + Math.ceil(averageSales(state.products[pid]) * 0.6) - have;
    if (need > 0) out[pid] = need;
  }
  // 2) emplacements libres : nouveaux produits (les plus demandés d'abord)
  const candidates = catalog
    .filter((pid) => !assigned.has(pid) && state.products[pid].reserve === 0 && !pending.has(pid))
    .sort((a, b) => PRODUCT_MAP[b].demand - PRODUCT_MAP[a].demand);
  for (const f of state.furniture) {
    for (const s of f.slots) {
      if (s.productId) continue;
      const idx = candidates.findIndex((pid) => canHold(f, pid));
      if (idx < 0) continue;
      const pid = candidates.splice(idx, 1)[0];
      out[pid] = slotCapacity(state, f, pid);
    }
  }
  return out;
}
