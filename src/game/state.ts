import { CATEGORIES } from '../data/categories';
import { PRODUCTS, PRODUCT_MAP } from '../data/products';
import { initialCompetitors } from '../data/progression';
import { MAIN_COLORS } from '../data/store';
import { BALANCE, SAVE_VERSION } from './constants';
import { roundPrice } from './economy/pricing';
import type { CategoryId, DayRecord, GameState, ProductState } from './types';

export function emptyDayRecord(day: number, rep: number, cash: number): DayRecord {
  return {
    day,
    revenue: 0,
    cogs: 0,
    purchases: 0,
    marketing: 0,
    charges: 0,
    taxes: 0,
    investments: 0,
    profit: 0,
    customers: 0,
    buyers: 0,
    itemsSold: 0,
    stockouts: 0,
    repStart: rep,
    repEnd: rep,
    satisfaction: 0,
    bestProduct: null,
    bestProductQty: 0,
    categoryRevenue: {},
    productUnits: {},
    stockoutProducts: [],
    cashEnd: cash,
    priceIndex: 1,
  };
}

export function initialProductState(id: string): ProductState {
  const def = PRODUCT_MAP[id];
  return {
    price: roundPrice(def.marketPrice),
    reserve: 0,
    avgCost: def.baseCost,
    avgQuality: 60,
    popularity: 1,
    soldTotal: 0,
    recentSales: [],
    soldToday: 0,
    stockoutsToday: 0,
    lastSupplier: null,
  };
}

export function createNewGame(opts: { seed?: number; storeName?: string; mainColor?: string } = {}): GameState {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const products: Record<string, ProductState> = {};
  for (const p of PRODUCTS) products[p.id] = initialProductState(p.id);
  const unlockedCategories: CategoryId[] = CATEGORIES.filter((c) => c.unlockLevel <= 1 && c.minStoreLevel <= 1).map((c) => c.id);
  const rep = BALANCE.startReputation;
  return {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    createdAt: Date.now(),
    day: 1,
    minute: BALANCE.dayStart,
    phase: 'prep',
    cash: BALANCE.startCash,
    totalRevenue: 0,
    totalProfit: 0,
    negativeDays: 0,
    bankrupt: false,
    storeLevel: 1,
    furniture: [],
    nextUid: 1,
    upgrades: [],
    customization: {
      storeName: opts.storeName?.trim() || 'Chez Moi',
      mainColor: opts.mainColor || MAIN_COLORS[0],
      signStyle: 0,
      floorStyle: 0,
      wallStyle: 0,
      ownedFloors: [0],
      ownedWalls: [0],
      ownedSigns: [0],
    },
    products,
    orders: [],
    nextOrderId: 1,
    campaigns: [],
    promotions: [],
    nextPromoId: 1,
    reputation: rep,
    xp: 0,
    level: 1,
    unlockedCategories,
    milestones: [],
    objectives: [],
    nextObjectiveId: 1,
    objectivesCompleted: 0,
    today: emptyDayRecord(1, rep, BALANCE.startCash),
    history: [],
    lifetime: { customers: 0, itemsSold: 0, campaigns: 0, categorySales: {}, profitableDays: 0 },
    competitors: initialCompetitors(),
    marketReports: [],
    marketShare: 0,
    pendingEvents: [],
    modifiers: [],
    nextEventId: 1,
    lastEventDay: 0,
    tutorial: { active: true, step: 0, done: false },
    settings: { sound: true, showGrid: true },
    log: [],
  };
}

export function isCategoryUnlocked(state: GameState, cat: CategoryId): boolean {
  return state.unlockedCategories.includes(cat);
}

export function isProductUnlocked(state: GameState, id: string): boolean {
  const def = PRODUCT_MAP[id];
  return !!def && state.level >= def.unlockLevel && isCategoryUnlocked(state, def.category);
}

export function unlockedProducts(state: GameState): string[] {
  return PRODUCTS.filter((p) => isProductUnlocked(state, p.id)).map((p) => p.id);
}
