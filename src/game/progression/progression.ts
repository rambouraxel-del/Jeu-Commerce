import { CATEGORIES, CATEGORY_MAP } from '../../data/categories';
import { FURNITURE } from '../../data/furniture';
import { CAMPAIGNS } from '../../data/marketing';
import { PRODUCTS } from '../../data/products';
import { MILESTONE_MAP } from '../../data/progression';
import { STORE_LEVELS, UPGRADES } from '../../data/store';
import { SUPPLIERS } from '../../data/suppliers';
import { euros } from '../../utils/format';
import { BALANCE, xpForLevel } from '../constants';
import type { GameEngine } from '../engine';
import { findFreeSpot } from '../store/layout';
import { distinctInStock } from '../store/stock';
import type { CategoryId, GameState, Objective, ObjectiveKind } from '../types';

export function levelProgress(state: GameState): { current: number; next: number; ratio: number } {
  const cur = xpForLevel(state.level);
  const next = xpForLevel(state.level + 1);
  if (state.level >= BALANCE.maxLevel) return { current: cur, next: cur, ratio: 1 };
  return { current: cur, next, ratio: Math.max(0, Math.min(1, (state.xp - cur) / Math.max(1, next - cur))) };
}

/** Ce qui se débloque en atteignant un niveau donné (textes pour l'interface). */
export function unlocksAtLevel(level: number): string[] {
  const out: string[] = [];
  for (const c of CATEGORIES) if (c.unlockLevel === level) out.push(`${c.icon} Catégorie ${c.name}${c.minStoreLevel > 1 ? ` (magasin niv. ${c.minStoreLevel})` : ''}`);
  for (const p of PRODUCTS) {
    const cat = CATEGORY_MAP[p.category];
    if (p.unlockLevel === level && cat.unlockLevel < level) out.push(`${p.icon} ${p.name}`);
  }
  for (const s of SUPPLIERS) if (s.unlockLevel === level && level > 1) out.push(`${s.icon} Fournisseur ${s.name}`);
  for (const f of FURNITURE) if (f.unlockLevel === level && level > 1) out.push(`${f.icon} ${f.name}`);
  for (const c of CAMPAIGNS) if (c.unlockLevel === level && level > 1) out.push(`${c.icon} Campagne ${c.name}`);
  for (const u of UPGRADES) if (u.unlockLevel === level) out.push(`${u.icon} Amélioration ${u.name}`);
  for (const s of STORE_LEVELS) if (s.requiredLevel === level && s.level > 1) out.push(`🏗️ Agrandissement : ${s.name}`);
  return out;
}

/** Met à jour les catégories débloquées. Renvoie les nouvelles catégories. */
export function refreshCategoryUnlocks(state: GameState): CategoryId[] {
  const added: CategoryId[] = [];
  for (const c of CATEGORIES) {
    if (state.unlockedCategories.includes(c.id)) continue;
    if (state.level >= c.unlockLevel && state.storeLevel >= c.minStoreLevel) {
      state.unlockedCategories.push(c.id);
      added.push(c.id);
    }
  }
  return added;
}

export function addXp(engine: GameEngine, amount: number): void {
  const s = engine.state;
  s.xp += Math.max(0, amount);
  while (s.level < BALANCE.maxLevel && s.xp >= xpForLevel(s.level + 1)) {
    s.level++;
    const unlocks = unlocksAtLevel(s.level);
    const cats = refreshCategoryUnlocks(s);
    for (const c of cats) engine.emit({ type: 'unlock', text: `${CATEGORY_MAP[c].icon} Nouvelle catégorie : ${CATEGORY_MAP[c].name}` });
    engine.emit({ type: 'levelUp', level: s.level, unlocks });
    engine.log(`Niveau ${s.level} atteint !`, 'good');
    checkMilestones(engine);
  }
}

// ---------------- Jalons ----------------

export function checkMilestones(engine: GameEngine): void {
  const s = engine.state;
  const has = (id: string) => s.milestones.includes(id);
  const conditions: Record<string, () => boolean> = {
    first_sale: () => s.lifetime.itemsSold > 0,
    first_profit_day: () => s.lifetime.profitableDays > 0,
    ca_1000: () => s.totalRevenue >= 100000,
    ca_10000: () => s.totalRevenue >= 1000000,
    ca_50000: () => s.totalRevenue >= 5000000,
    ca_100000: () => s.totalRevenue >= 10000000,
    ca_500000: () => s.totalRevenue >= 50000000,
    ca_1m: () => s.totalRevenue >= 100000000,
    expansion_1: () => s.storeLevel >= 2,
    store_3: () => s.storeLevel >= 3,
    store_4: () => s.storeLevel >= 4,
    store_5: () => s.storeLevel >= 5,
    store_6: () => s.storeLevel >= 6,
    unlock_hygiene: () => s.unlockedCategories.includes('hygiene'),
    unlock_maison: () => s.unlockedCategories.includes('maison'),
    unlock_vetements: () => s.unlockedCategories.includes('vetements'),
    unlock_technologie: () => s.unlockedCategories.includes('technologie'),
    unlock_premium: () => s.unlockedCategories.includes('premium'),
    rep_50: () => s.reputation >= 50,
    rep_80: () => s.reputation >= 80,
    share_10: () => s.marketShare >= 0.1,
    share_25: () => s.marketShare >= 0.25,
    customers_1000: () => s.lifetime.customers >= 1000,
    customers_10000: () => s.lifetime.customers >= 10000,
    level_10: () => s.level >= 10,
    level_20: () => s.level >= 20,
  };
  for (const id in conditions) {
    if (has(id) || !conditions[id]()) continue;
    const m = MILESTONE_MAP[id];
    s.milestones.push(id);
    s.cash += m.rewardCash;
    engine.emit({ type: 'milestone', id });
    engine.log(`Jalon « ${m.name} » : +${euros(m.rewardCash)}`, 'good');
    if (m.rewardXp) addXp(engine, m.rewardXp);
  }
}

// ---------------- Objectifs ----------------

function objectiveText(kind: ObjectiveKind, target: number, param?: string): string {
  switch (kind) {
    case 'sellItems':
      return `Vendre ${target} articles`;
    case 'dayRevenue':
      return `Faire ${euros(target, 0)} de CA en une journée`;
    case 'dayCustomers':
      return `Accueillir ${target} clients en une journée`;
    case 'reachReputation':
      return `Atteindre ${target} de réputation`;
    case 'sellCategory':
      return `Vendre ${target} articles « ${CATEGORY_MAP[param as CategoryId]?.name} »`;
    case 'noStockoutDay':
      return 'Terminer une journée sans aucune rupture (min. 15 clients)';
    case 'dayProfit':
      return `Réaliser ${euros(target, 0)} de bénéfice en une journée`;
    case 'distinctProducts':
      return `Proposer ${target} produits différents en rayon`;
    case 'runCampaign':
      return 'Lancer une campagne marketing';
    case 'placeDeco':
      return `Installer ${target} décorations`;
    case 'placeShelves':
      return `Installer ${target} rayons`;
    case 'conversion':
      return `Atteindre ${target} % de conversion sur une journée (min. 20 clients)`;
  }
}

function rewardFor(state: GameState, difficulty: number): { cash: number; xp: number; rep: number } {
  const scale = [1, 2.5, 6, 15, 35, 80][state.storeLevel - 1] ?? 1;
  return {
    cash: Math.round((3000 + 2000 * difficulty) * scale / 100) * 100,
    xp: Math.round((30 + 25 * difficulty) * scale),
    rep: difficulty >= 2 ? 1 : 0,
  };
}

function bestRecent(state: GameState, f: (r: GameState['history'][number]) => number): number {
  let best = 0;
  for (const r of state.history.slice(-7)) best = Math.max(best, f(r));
  return best;
}

export function makeObjective(engine: GameEngine, kind: ObjectiveKind): Objective {
  const s = engine.state;
  const rng = engine.rng;
  let target = 1;
  let param: string | undefined;
  let difficulty = 1;
  const lvl = s.storeLevel;
  switch (kind) {
    case 'sellItems':
      target = Math.round((20 + 40 * lvl * lvl) * rng.range(0.9, 1.3) / 5) * 5;
      break;
    case 'dayRevenue': {
      const best = bestRecent(s, (r) => r.revenue);
      target = Math.max(10000 * lvl, Math.round((best * rng.range(1.1, 1.25)) / 1000) * 1000);
      difficulty = 2;
      break;
    }
    case 'dayCustomers': {
      const best = bestRecent(s, (r) => r.customers);
      target = Math.max(20, Math.round((best * rng.range(1.1, 1.2)) / 5) * 5);
      break;
    }
    case 'reachReputation':
      target = Math.min(95, Math.ceil(s.reputation / 5) * 5 + 5);
      difficulty = 2;
      break;
    case 'sellCategory': {
      const cats = s.unlockedCategories;
      const recent = cats.filter((c) => (s.lifetime.categorySales[c] ?? 0) < 50);
      param = rng.pick(recent.length ? recent : cats);
      target = Math.round((10 + 12 * lvl) / 5) * 5;
      break;
    }
    case 'noStockoutDay':
      difficulty = 2;
      break;
    case 'dayProfit': {
      const best = bestRecent(s, (r) => r.profit);
      target = Math.max(5000 * lvl, Math.round((Math.max(0, best) * rng.range(1.1, 1.3)) / 1000) * 1000);
      difficulty = 2;
      break;
    }
    case 'distinctProducts':
      target = Math.min(distinctInStock(s) + rng.int(2, 4), 80);
      break;
    case 'runCampaign':
      param = String(s.lifetime.campaigns);
      break;
    case 'placeDeco': {
      const decos = s.furniture.filter((f) => !f.slots.length).length;
      target = decos + rng.int(1, 3);
      break;
    }
    case 'placeShelves': {
      const shelves = s.furniture.filter((f) => f.slots.length).length;
      target = shelves + rng.int(1, 2);
      break;
    }
    case 'conversion':
      target = rng.pick([70, 75, 80]);
      difficulty = 2;
      break;
  }
  const r = rewardFor(s, difficulty);
  return {
    id: s.nextObjectiveId++,
    kind,
    target,
    progress: 0,
    param,
    rewardCash: r.cash,
    rewardXp: r.xp,
    rewardRep: r.rep,
    text: objectiveText(kind, target, param),
    done: false,
  };
}

const FIRST_OBJECTIVES: ObjectiveKind[] = ['sellItems', 'dayCustomers', 'placeShelves'];

export function refillObjectives(engine: GameEngine): void {
  const s = engine.state;
  s.objectives = s.objectives.filter((o) => !o.done);
  if (s.objectivesCompleted === 0 && s.objectives.length === 0 && s.day === 1) {
    for (const k of FIRST_OBJECTIVES) {
      const o = makeObjective(engine, k);
      if (k === 'sellItems') {
        o.target = 20;
        o.text = objectiveText('sellItems', 20);
      }
      if (k === 'dayCustomers') {
        o.target = 20;
        o.text = objectiveText('dayCustomers', 20);
      }
      s.objectives.push(o);
    }
    return;
  }
  const pool: ObjectiveKind[] = [
    'sellItems', 'dayRevenue', 'dayCustomers', 'reachReputation', 'sellCategory', 'noStockoutDay',
    'dayProfit', 'distinctProducts', 'runCampaign', 'placeDeco', 'placeShelves', 'conversion',
  ];
  let guard = 0;
  while (s.objectives.length < 3 && guard++ < 50) {
    const kind = engine.rng.pick(pool);
    if (s.objectives.some((o) => o.kind === kind)) continue;
    if (kind === 'reachReputation' && s.reputation >= 92) continue;
    // pas d'objectif d'installation si le magasin est plein
    if (kind === 'placeShelves' && !findFreeSpot(s.storeLevel, s.furniture, 'etagere')) continue;
    if (kind === 'placeDeco' && !findFreeSpot(s.storeLevel, s.furniture, 'plante')) continue;
    s.objectives.push(makeObjective(engine, kind));
  }
}

function completeObjective(engine: GameEngine, o: Objective): void {
  const s = engine.state;
  o.done = true;
  o.progress = o.target;
  s.objectivesCompleted++;
  s.cash += o.rewardCash;
  s.reputation = Math.min(100, s.reputation + o.rewardRep);
  engine.emit({ type: 'objective', objective: { ...o } });
  engine.log(`Objectif réussi : ${o.text} (+${euros(o.rewardCash)})`, 'good');
  addXp(engine, o.rewardXp);
}

/** Évalue les objectifs « en direct » (appelé régulièrement et à chaque vente). */
export function updateObjectivesLive(engine: GameEngine): void {
  const s = engine.state;
  const t = s.today;
  for (const o of s.objectives) {
    if (o.done) continue;
    switch (o.kind) {
      case 'dayRevenue':
        o.progress = Math.max(o.progress, t.revenue);
        break;
      case 'dayCustomers':
        o.progress = Math.max(o.progress, t.customers);
        break;
      case 'reachReputation':
        o.progress = Math.floor(s.reputation);
        break;
      case 'distinctProducts':
        o.progress = distinctInStock(s);
        break;
      case 'placeDeco':
        o.progress = s.furniture.filter((f) => !f.slots.length).length;
        break;
      case 'placeShelves':
        o.progress = s.furniture.filter((f) => f.slots.length).length;
        break;
      case 'runCampaign':
        o.progress = s.lifetime.campaigns > Number(o.param ?? 0) ? 1 : 0;
        o.target = 1;
        break;
      default:
        break;
    }
    if (o.progress >= o.target && !['noStockoutDay', 'dayProfit', 'conversion'].includes(o.kind)) completeObjective(engine, o);
  }
}

export function onItemsSold(engine: GameEngine, category: CategoryId, qty: number): void {
  for (const o of engine.state.objectives) {
    if (o.done) continue;
    if (o.kind === 'sellItems') o.progress += qty;
    if (o.kind === 'sellCategory' && o.param === category) o.progress += qty;
    if ((o.kind === 'sellItems' || o.kind === 'sellCategory') && o.progress >= o.target) completeObjective(engine, o);
  }
}

/** Objectifs évalués en fin de journée. */
export function updateObjectivesEndOfDay(engine: GameEngine): void {
  const s = engine.state;
  const t = s.today;
  for (const o of s.objectives) {
    if (o.done) continue;
    if (o.kind === 'noStockoutDay' && t.customers >= 15 && t.stockouts === 0) completeObjective(engine, o);
    if (o.kind === 'dayProfit') {
      o.progress = Math.max(o.progress, t.profit);
      if (t.profit >= o.target) completeObjective(engine, o);
    }
    if (o.kind === 'conversion' && t.customers >= 20) {
      const conv = Math.round((t.buyers / t.customers) * 100);
      o.progress = Math.max(o.progress, conv);
      if (conv >= o.target) completeObjective(engine, o);
    }
  }
  updateObjectivesLive(engine);
}
