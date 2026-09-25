// Joueur automatique utilisé pour les simulations d'équilibrage et les tests.
// Il n'a accès qu'aux actions publiques du moteur, comme un vrai joueur.

import { FURNITURE, FURNITURE_MAP } from '../../data/furniture';
import { CAMPAIGNS } from '../../data/marketing';
import { PRODUCT_MAP } from '../../data/products';
import { STORE_LEVELS, UPGRADES } from '../../data/store';
import { SUPPLIER_MAP } from '../../data/suppliers';
import { roundPrice } from '../economy/pricing';
import type { GameEngine } from '../engine';
import { isProductUnlocked, unlockedProducts } from '../state';
import { findFreeSpot, levelDef, validatePlacement } from '../store/layout';
import { assignedProducts, averageSales, canHold, shelfCapacity, totalStock } from '../store/stock';
import { availableSuppliers, supplierCatalog, supplierQuality, supplierUnitCost } from '../suppliers/orders';
import type { CategoryId } from '../types';

export interface BotStrategy {
  name: string;
  /** Prix = marché × priceRatio. */
  priceRatio: number;
  /** 'cheap' : fournisseur le moins cher ; 'premium' : meilleure qualité ; 'balanced'. */
  sourcing: 'cheap' | 'premium' | 'balanced';
  /** Part du CA quotidien réinvestie en marketing (0 = aucun). */
  marketing: number;
  /** Multiplicateur de stock visé (1 = remplir les rayons, 0.35 = sous-stock, 3 = surstock). */
  stockTarget: number;
  /** Nombre max de produits différents (diversification). */
  maxProducts: number;
  expand: boolean;
  upgrades: boolean;
  decorate: boolean;
}

export const STRATEGIES: Record<string, BotStrategy> = {
  market: { name: 'Prix marché (équilibré)', priceRatio: 1.0, sourcing: 'balanced', marketing: 0.04, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  lowPrice: { name: 'Prix bas (−20 %)', priceRatio: 0.8, sourcing: 'balanced', marketing: 0.04, stockTarget: 1.3, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  highPrice: { name: 'Prix élevés (+35 %)', priceRatio: 1.35, sourcing: 'balanced', marketing: 0.04, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  lowCost: { name: 'Low-cost (discount)', priceRatio: 0.85, sourcing: 'cheap', marketing: 0.03, stockTarget: 1.3, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  premium: { name: 'Premium (qualité +15 %)', priceRatio: 1.15, sourcing: 'premium', marketing: 0.04, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  heavyMarketing: { name: 'Marketing intensif', priceRatio: 1.0, sourcing: 'balanced', marketing: 0.15, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  noMarketing: { name: 'Aucun marketing', priceRatio: 1.0, sourcing: 'balanced', marketing: 0, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  narrow: { name: 'Faible diversification (8 produits)', priceRatio: 1.0, sourcing: 'balanced', marketing: 0.04, stockTarget: 1.2, maxProducts: 8, expand: true, upgrades: true, decorate: true },
  understock: { name: 'Stock insuffisant', priceRatio: 1.0, sourcing: 'balanced', marketing: 0.04, stockTarget: 0.35, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  overstock: { name: 'Surstock', priceRatio: 1.0, sourcing: 'balanced', marketing: 0.04, stockTarget: 4, maxProducts: 999, expand: true, upgrades: true, decorate: true },
  abusive: { name: 'Prix abusifs (×2)', priceRatio: 2.0, sourcing: 'balanced', marketing: 0.04, stockTarget: 1.2, maxProducts: 999, expand: true, upgrades: true, decorate: true },
};

function bestSupplierFor(engine: GameEngine, productId: string, sourcing: BotStrategy['sourcing']): string | null {
  const s = engine.state;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const sup of availableSuppliers(s)) {
    if (!supplierCatalog(s, sup.id).includes(productId)) continue;
    const cost = supplierUnitCost(s, sup.id, productId);
    const q = supplierQuality(sup.id, productId);
    const market = PRODUCT_MAP[productId].marketPrice;
    let score: number;
    if (sourcing === 'cheap') score = -cost;
    else if (sourcing === 'premium') score = q * 10 - cost / market;
    else score = (market - cost) / market * 100 + q * 0.6 - (sup.delayDays > 1 ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = sup.id;
    }
  }
  return best;
}

const SHELF_FOR: Partial<Record<CategoryId, string[]>> = {
  frais: ['frigo_xl', 'frigo'],
  boulangerie: ['panier_pain', 'etagere'],
  vetements: ['portant'],
  technologie: ['vitrine', 'presentoir_lux'],
  electronique: ['vitrine'],
  premium: ['presentoir_lux', 'vitrine', 'frigo_xl'],
};

export class Bot {
  constructor(public engine: GameEngine, public strategy: BotStrategy) {}

  /** Actions de préparation avant l'ouverture. */
  prepare(): void {
    const e = this.engine;
    const s = e.state;
    for (const ev of [...s.pendingEvents]) {
      // accepte les offres si la trésorerie est confortable
      const r = e.resolveEvent(ev.id, ev.choices.length > 1 && s.cash > 500000 ? 0 : ev.choices.length - 1);
      if (!r.ok) e.resolveEvent(ev.id, ev.choices.length - 1);
    }
    this.expandIfPossible();
    this.buildShelves();
    this.assignProducts();
    this.setPrices();
    this.order();
    this.receiveAll();
    this.marketingAndUpgrades();
    e.restock();
  }

  receiveAll(): void {
    for (const o of this.engine.state.orders) if (o.status === 'arrived') this.engine.receiveDeliveryNow(o.id);
  }

  private wantedProducts(): string[] {
    const s = this.engine.state;
    const list = unlockedProducts(s).sort((a, b) => PRODUCT_MAP[b].demand - PRODUCT_MAP[a].demand);
    return list.slice(0, this.strategy.maxProducts);
  }

  private expandIfPossible(): void {
    if (!this.strategy.expand) return;
    const e = this.engine;
    const next = STORE_LEVELS[e.state.storeLevel];
    if (!next) return;
    // garde une réserve pour le stock
    if (e.state.cash > next.cost * 1.15 + 50000 && e.canExpand().ok) e.expandStore();
  }

  private buildShelves(): void {
    const e = this.engine;
    const s = e.state;
    const wanted = this.wantedProducts().filter((p) => !assignedProducts(s).has(p));
    let guard = 0;
    for (const pid of wanted) {
      if (guard++ > 12) break;
      if (this.hasFreeSlot(pid)) continue;
      const cat = PRODUCT_MAP[pid].category;
      const options = (SHELF_FOR[cat] ?? ['gondole', 'etagere']).filter((id) => {
        const d = FURNITURE_MAP[id];
        return s.level >= d.unlockLevel && d.categories?.includes(cat) && (!d.requiresUpgrade || s.upgrades.includes(d.requiresUpgrade));
      });
      const defId = options[0] ?? FURNITURE.find((f) => f.kind === 'shelf' && f.categories?.includes(cat) && s.level >= f.unlockLevel && !f.requiresUpgrade)?.id;
      if (!defId) continue;
      const def = FURNITURE_MAP[defId];
      if (s.cash < def.cost + 20000) break;
      const spot = this.findAisleSpot(defId);
      if (!spot) break;
      e.buyFurniture(defId, spot.x, spot.y, spot.rot);
    }
    if (this.strategy.decorate && s.cash > 300000 * s.storeLevel) {
      const decos = s.furniture.filter((f) => FURNITURE_MAP[f.defId].kind === 'deco').length;
      const area = levelDef(s.storeLevel).w * levelDef(s.storeLevel).h;
      if (decos < area / 18) {
        const d = [...FURNITURE].filter((f) => f.kind === 'deco' && f.unlockLevel <= s.level && f.w * f.h === 1).pop();
        if (d && s.cash > d.cost * 4) {
          const spot = findFreeSpot(s.storeLevel, s.furniture, d.id);
          if (spot) e.buyFurniture(d.id, spot.x, spot.y, spot.rot);
        }
      }
    }
  }

  /** Cherche un emplacement en rangées avec allées (une rangée sur deux). */
  private findAisleSpot(defId: string): { x: number; y: number; rot: 0 | 1 } | null {
    const s = this.engine.state;
    const def = levelDef(s.storeLevel);
    for (let y = 0; y < def.h - 3; y += 2) {
      for (let x = 0; x < def.w; x++) {
        const cand = { defId, x, y, rot: 0 as const };
        if (validatePlacement(s.storeLevel, s.furniture, cand) === null) return cand;
      }
    }
    return findFreeSpot(s.storeLevel, s.furniture, defId);
  }

  private hasFreeSlot(pid: string): boolean {
    return this.engine.state.furniture.some((f) => canHold(f, pid) && f.slots.some((sl) => sl.productId === null));
  }

  private assignProducts(): void {
    const e = this.engine;
    const s = e.state;
    const assigned = assignedProducts(s);
    for (const pid of this.wantedProducts()) {
      if (assigned.has(pid)) continue;
      for (const f of s.furniture) {
        if (!canHold(f, pid)) continue;
        const i = f.slots.findIndex((sl) => sl.productId === null);
        if (i >= 0) {
          e.assignSlot(f.uid, i, pid);
          assigned.add(pid);
          break;
        }
      }
    }
  }

  private setPrices(): void {
    const e = this.engine;
    for (const pid of assignedProducts(e.state)) {
      const target = roundPrice(PRODUCT_MAP[pid].marketPrice * this.strategy.priceRatio);
      if (e.state.products[pid].price !== target) e.setPrice(pid, target);
    }
  }

  private order(): void {
    const e = this.engine;
    const s = e.state;
    const bySupplier = new Map<string, { productId: string; qty: number }[]>();
    const pending = new Map<string, number>();
    for (const o of s.orders) if (o.status !== 'received') for (const l of o.lines) pending.set(l.productId, (pending.get(l.productId) ?? 0) + l.qty);
    for (const pid of assignedProducts(s)) {
      if (!isProductUnlocked(s, pid)) continue;
      const cap = shelfCapacity(s, pid);
      const avg = averageSales(s.products[pid]);
      const target = Math.ceil(Math.max(cap, avg * 1.3) * this.strategy.stockTarget);
      const have = totalStock(s, pid) + (pending.get(pid) ?? 0);
      const need = target - have;
      if (need < Math.max(2, target * 0.3)) continue;
      const sup = bestSupplierFor(e, pid, this.strategy.sourcing);
      if (!sup) continue;
      const list = bySupplier.get(sup) ?? [];
      list.push({ productId: pid, qty: need });
      bySupplier.set(sup, list);
    }
    for (const [sup, lines] of bySupplier) {
      let total = lines.reduce((a, l) => a + supplierUnitCost(s, sup, l.productId) * l.qty, 0);
      const min = SUPPLIER_MAP[sup].minOrder;
      if (total < min) {
        // compléter jusqu'au minimum ou passer par le grossiste
        const alt = 'grossiste';
        const altLines = lines.filter((l) => supplierCatalog(s, alt).includes(l.productId));
        if (altLines.length) e.placeOrder(alt, altLines);
        continue;
      }
      if (total > s.cash * 0.9) {
        const ratio = (s.cash * 0.9) / total;
        for (const l of lines) l.qty = Math.floor(l.qty * ratio);
        total = lines.reduce((a, l) => a + supplierUnitCost(s, sup, l.productId) * l.qty, 0);
        if (total < min) continue;
      }
      e.placeOrder(sup, lines.filter((l) => l.qty > 0));
    }
  }

  private marketingAndUpgrades(): void {
    const e = this.engine;
    const s = e.state;
    const last = s.history[s.history.length - 1];
    if (this.strategy.marketing > 0 && last) {
      const budget = last.revenue * this.strategy.marketing * 3;
      const affordable = CAMPAIGNS.filter((c) => c.unlockLevel <= s.level && c.cost <= budget && c.cost < s.cash * 0.3 && !s.campaigns.some((x) => x.id === c.id));
      const pick = affordable.sort((a, b) => b.cost - a.cost)[0];
      if (pick) e.launchCampaign(pick.id);
    }
    if (this.strategy.upgrades) {
      const next = STORE_LEVELS[s.storeLevel];
      const saving = next ? next.cost * 0.6 : 0;
      for (const u of UPGRADES) {
        if (s.upgrades.includes(u.id)) continue;
        if (s.cash - u.cost > saving + 100000) e.buyUpgrade(u.id);
      }
    }
  }

  /** Joue une journée complète. */
  playDay(): void {
    const e = this.engine;
    if (e.state.phase === 'report') e.nextDay();
    if (e.state.bankrupt) return;
    this.prepare();
    e.startDay();
    // réception des livraisons en cours de journée + réassort régulier
    while (e.state.phase === 'running' || e.state.phase === 'closing') {
      e.tick(30);
      this.receiveAll();
      if (Math.floor(e.state.minute) % 180 < 30 && e.state.phase === 'running') this.order();
    }
  }
}

export function runBot(engine: GameEngine, strategy: BotStrategy, days: number, onDay?: (day: number) => void): void {
  const bot = new Bot(engine, strategy);
  for (let i = 0; i < days && !engine.state.bankrupt; i++) {
    bot.playDay();
    onDay?.(engine.state.day);
  }
}
