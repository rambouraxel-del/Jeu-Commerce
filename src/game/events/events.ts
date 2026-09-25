import { CATEGORY_MAP } from '../../data/categories';
import { PRODUCT_MAP } from '../../data/products';
import { SUPPLIER_MAP } from '../../data/suppliers';
import { euros } from '../../utils/format';
import { BALANCE } from '../constants';
import type { GameEngine } from '../engine';
import { assignedProducts } from '../store/stock';
import { availableSuppliers, supplierCatalog, supplierQuality, supplierUnitCost } from '../suppliers/orders';
import type { PendingEvent } from '../types';

type EventFactory = (engine: GameEngine) => PendingEvent | null;

function scaleCost(engine: GameEngine, base: number): number {
  return Math.round((base * [1, 2.5, 6, 15, 35, 80][engine.state.storeLevel - 1]) / 100) * 100;
}

const FACTORIES: Record<string, { weight: number; make: EventFactory }> = {
  influencer_good: {
    weight: 1,
    make: (e) => ({
      id: e.state.nextEventId++,
      type: 'influencer_good',
      title: 'Un influenceur parle de vous !',
      text: 'Une vidéo sur votre magasin circule dans le quartier. Réputation +3 et fréquentation +30 % pendant 3 jours.',
      choices: [{ label: 'Génial !', detail: '' }],
      data: {},
    }),
  },
  exclusive_deal: {
    weight: 1,
    make: (e) => {
      const sups = availableSuppliers(e.state);
      const s = e.rng.pick(sups);
      const cost = scaleCost(e, 15000);
      return {
        id: e.state.nextEventId++,
        type: 'exclusive_deal',
        title: 'Accord exclusif proposé',
        text: `${s.name} vous propose un accord : −15 % sur tout son catalogue pendant 14 jours, contre un droit d’entrée de ${euros(cost)}.`,
        choices: [
          { label: `Accepter (${euros(cost)})`, detail: '−15 % pendant 14 jours' },
          { label: 'Refuser', detail: '' },
        ],
        data: { supplierId: s.id, cost },
      };
    },
  },
  trend: {
    weight: 1.2,
    make: (e) => {
      const cats = e.state.unlockedCategories;
      const cat = e.rng.pick(cats);
      return {
        id: e.state.nextEventId++,
        type: 'trend',
        title: 'Nouvelle tendance',
        text: `La catégorie ${CATEGORY_MAP[cat].icon} ${CATEGORY_MAP[cat].name} devient tendance ! Demande +70 % pendant 7 jours.`,
        choices: [{ label: 'Compris', detail: '' }],
        data: { category: cat },
      };
    },
  },
  supplier_raise: {
    weight: 0.8,
    make: (e) => {
      const s = e.rng.pick(availableSuppliers(e.state));
      return {
        id: e.state.nextEventId++,
        type: 'supplier_raise',
        title: 'Hausse de tarifs',
        text: `${s.name} augmente temporairement ses prix de 20 % pendant 7 jours.`,
        choices: [{ label: 'Compris', detail: '' }],
        data: { supplierId: s.id },
      };
    },
  },
  delivery_delay: {
    weight: 0.8,
    make: (e) => {
      const o = e.state.orders.find((x) => x.status === 'transit');
      if (!o) return null;
      return {
        id: e.state.nextEventId++,
        type: 'delivery_delay',
        title: 'Livraison retardée',
        text: `Un problème logistique chez ${SUPPLIER_MAP[o.supplierId].name} : la commande n°${o.id} arrivera avec un jour de retard.`,
        choices: [{ label: 'Tant pis', detail: '' }],
        data: { orderId: o.id },
      };
    },
  },
  influencer_bad: {
    weight: 0.7,
    make: (e) => {
      const s = e.state;
      const sold = [...assignedProducts(s)].filter((id) => s.products[id].soldTotal > 0);
      if (!sold.length) return null;
      sold.sort((a, b) => s.products[a].avgQuality - s.products[b].avgQuality);
      const pid = sold[0];
      const cost = scaleCost(e, 8000);
      return {
        id: s.nextEventId++,
        type: 'influencer_bad',
        title: 'Un influenceur mécontent',
        text: `Un influenceur critique votre produit « ${PRODUCT_MAP[pid].name} » (qualité ${Math.round(s.products[pid].avgQuality)}/100).`,
        choices: [
          { label: `Offrir un geste commercial (${euros(cost)})`, detail: 'Pas de perte de réputation' },
          { label: 'Ignorer', detail: 'Réputation −4' },
        ],
        data: { productId: pid, cost },
      };
    },
  },
  bulk_offer: {
    weight: 1,
    make: (e) => {
      const s = e.state;
      const sup = e.rng.pick(availableSuppliers(s));
      const cat = supplierCatalog(s, sup.id);
      if (!cat.length) return null;
      const pid = e.rng.pick(cat);
      const qty = Math.max(10, Math.round(30 * s.storeLevel / PRODUCT_MAP[pid].volume));
      const unit = Math.round(supplierUnitCost(s, sup.id, pid) * 0.6);
      return {
        id: s.nextEventId++,
        type: 'bulk_offer',
        title: 'Lot à prix cassé',
        text: `${sup.name} liquide un lot de ${qty} × ${PRODUCT_MAP[pid].name} à −40 % (${euros(unit)} l’unité), livré demain matin.`,
        choices: [
          { label: `Acheter (${euros(unit * qty)})`, detail: 'Livraison demain matin' },
          { label: 'Refuser', detail: '' },
        ],
        data: { supplierId: sup.id, productId: pid, qty, unit },
      };
    },
  },
  party: {
    weight: 0.8,
    make: (e) => {
      const cost = scaleCost(e, 10000);
      return {
        id: e.state.nextEventId++,
        type: 'party',
        title: 'Fête de quartier',
        text: `Le comité de quartier cherche un sponsor pour sa fête ce week-end.`,
        choices: [
          { label: `Sponsoriser (${euros(cost)})`, detail: 'Réputation +2, fréquentation +20 % 2 jours' },
          { label: 'Décliner', detail: '' },
        ],
        data: { cost },
      };
    },
  },
};

export function rollRandomEvent(engine: GameEngine): PendingEvent | null {
  const s = engine.state;
  if (s.day < 4) return null;
  if (s.day - s.lastEventDay < BALANCE.eventMinGap) return null;
  if (!engine.rng.chance(BALANCE.eventChance)) return null;
  const keys = Object.keys(FACTORIES);
  for (let tries = 0; tries < 4; tries++) {
    const key = engine.rng.weighted(keys, (k) => FACTORIES[k].weight)!;
    const ev = FACTORIES[key].make(engine);
    if (ev) {
      s.lastEventDay = s.day;
      return ev;
    }
  }
  return null;
}

export function createEventByType(engine: GameEngine, type: string): PendingEvent | null {
  return FACTORIES[type]?.make(engine) ?? null;
}

/** Applique le choix du joueur. Renvoie un message d'erreur éventuel. */
export function applyEventChoice(engine: GameEngine, ev: PendingEvent, choice: number): string | null {
  const s = engine.state;
  const addMod = (type: any, target: string | null, value: number, days: number, label: string) =>
    s.modifiers.push({ id: s.nextEventId++, type, target, value, daysLeft: days, label });
  switch (ev.type) {
    case 'influencer_good':
      s.reputation = Math.min(100, s.reputation + 3);
      addMod('traffic', null, 0.3, 3, 'Buzz influenceur');
      break;
    case 'exclusive_deal':
      if (choice === 0) {
        if (s.cash < ev.data.cost) return 'Trésorerie insuffisante';
        engine.spend(ev.data.cost, 'marketing');
        addMod('supplierDiscount', ev.data.supplierId, 0.15, 14, `Accord ${SUPPLIER_MAP[ev.data.supplierId].name}`);
      }
      break;
    case 'trend':
      addMod('categoryDemand', ev.data.category, 0.7, 7, `Tendance ${CATEGORY_MAP[ev.data.category as keyof typeof CATEGORY_MAP].name}`);
      break;
    case 'supplier_raise':
      addMod('supplierPrice', ev.data.supplierId, 0.2, 7, `Hausse ${SUPPLIER_MAP[ev.data.supplierId].name}`);
      break;
    case 'delivery_delay': {
      const o = s.orders.find((x) => x.id === ev.data.orderId);
      if (o && o.status === 'transit') {
        o.arrivalDay += 1;
        o.arrivalMinute = BALANCE.dayStart;
      }
      break;
    }
    case 'influencer_bad':
      if (choice === 0) {
        if (s.cash < ev.data.cost) return 'Trésorerie insuffisante';
        engine.spend(ev.data.cost, 'marketing');
      } else {
        s.reputation = Math.max(0, s.reputation - 4);
      }
      break;
    case 'bulk_offer':
      if (choice === 0) {
        const total = ev.data.unit * ev.data.qty;
        if (s.cash < total) return 'Trésorerie insuffisante';
        s.cash -= total;
        s.orders.push({
          id: s.nextOrderId++,
          supplierId: ev.data.supplierId,
          lines: [{ productId: ev.data.productId, qty: ev.data.qty, unitCost: ev.data.unit, quality: supplierQuality(ev.data.supplierId, ev.data.productId) }],
          total,
          placedDay: s.day,
          placedMinute: s.minute,
          arrivalDay: s.day + (s.phase === 'prep' ? 0 : 1),
          arrivalMinute: s.phase === 'prep' ? BALANCE.dayStart + 30 : BALANCE.dayStart,
          status: 'transit',
        });
        s.today.purchases += total;
      }
      break;
    case 'party':
      if (choice === 0) {
        if (s.cash < ev.data.cost) return 'Trésorerie insuffisante';
        engine.spend(ev.data.cost, 'marketing');
        s.reputation = Math.min(100, s.reputation + 2);
        addMod('traffic', null, 0.2, 2, 'Fête de quartier');
      }
      break;
  }
  return null;
}
