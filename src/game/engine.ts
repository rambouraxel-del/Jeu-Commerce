// Moteur de simulation : totalement indépendant du rendu.
// Il peut tourner sans interface (tests, simulations d'équilibrage).

import { CATEGORY_MAP } from '../data/categories';
import { FURNITURE_MAP } from '../data/furniture';
import { CAMPAIGN_MAP } from '../data/marketing';
import { PRODUCT_MAP } from '../data/products';
import { FLOOR_STYLES, SIGN_STYLES, STORE_LEVELS, UPGRADE_MAP, WALL_STYLES } from '../data/store';
import { SUPPLIER_MAP } from '../data/suppliers';
import { euros } from '../utils/format';
import { calendarTraffic, dateInfo, isMonthStart } from './calendar/calendar';
import { computeMarketReport } from './competition/market';
import { BALANCE } from './constants';
import {
  considerProduct,
  createCustomer,
  finalizeSatisfaction,
  type Reaction,
} from './customers/customers';
import { ambianceSatisfaction, ambianceScore, dailyCharges } from './economy/finance';
import { applyEventChoice, rollRandomEvent } from './events/events';
import { campaignTraffic } from './marketing/marketing';
import { findPath, type Point } from './pathfinding/astar';
import {
  addXp,
  checkMilestones,
  refillObjectives,
  refreshCategoryUnlocks,
  updateObjectivesEndOfDay,
  updateObjectivesLive,
} from './progression/progression';
import { Rng } from './rng';
import { createNewGame, emptyDayRecord, isProductUnlocked } from './state';
import {
  accessCells,
  buildGrid,
  expansionOffset,
  geometry,
  levelDef,
  PLACEMENT_MESSAGES,
  validatePlacement,
  type Grid,
} from './store/layout';
import {
  addToInventory,
  canHold,
  distinctInStock,
  emptyFurniture,
  restockFromReserve,
  shelveUnits,
  totalStock,
} from './store/stock';
import { computeArrival, supplierCatalog, supplierQuality, supplierUnitCost } from './suppliers/orders';
import type {
  Avatar,
  Customer,
  EngineEvent,
  GameState,
  Order,
  PlacedFurniture,
  PromoScope,
} from './types';

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export const TUTORIAL_STEPS = [
  { title: 'Installez un rayon', text: 'Touchez 🛠️ Aménager, choisissez une Étagère puis posez-la dans le magasin.' },
  { title: 'Un réfrigérateur', text: 'Le lait et les œufs doivent être au frais : installez aussi un Réfrigérateur.' },
  { title: 'Commandez des produits', text: 'Ouvrez 💻 Ordinateur › Fournisseurs et commandez du lait, des œufs, des pâtes, du pain…' },
  { title: 'Lancez la journée', text: 'Touchez ▶ Démarrer. Le camion du grossiste arrivera vers 07:30.' },
  { title: 'Réceptionnez la livraison', text: 'Le camion est arrivé ! Touchez-le : votre personnage va chercher les cartons et les produits iront en rayon.' },
  { title: 'Vérifiez vos prix', text: 'Ouvrez 📦 Stock pour voir vos produits, leur marge et ajuster vos prix de vente.' },
  { title: 'Premières ventes', text: 'À 08:00 le magasin ouvre. Regardez les clients faire leurs courses !' },
  { title: 'Bilan de journée', text: 'À 20:00 le magasin ferme : consultez le bilan puis passez au jour suivant.' },
];

export class GameEngine {
  state: GameState;
  rng: Rng;
  headless: boolean;
  customers: Customer[] = [];
  avatar: Avatar;
  nextCustomerId = 1;
  version = 0;
  grid!: Grid;
  queues: number[][] = [];
  pickupQueue: number[] = [];
  expectedToday = 0;
  marketValueToday = 0;
  satisfactionSum = 0;
  satisfactionCount = 0;
  ambianceBonus = 0;
  distinctCache = 0;
  isSummer = false;
  private xpFraction = 0;
  private listeners = new Set<(e: EngineEvent) => void>();
  private changeListeners = new Set<() => void>();
  private pathCache = new Map<string, Point[] | null>();
  private lastReactionMinute = -999;
  private liveCounter = 0;
  private lastDoorSound = -999;

  constructor(state: GameState, opts: { headless?: boolean } = {}) {
    this.state = state;
    this.rng = new Rng(state.rngState);
    this.headless = !!opts.headless;
    const geo = geometry(state.storeLevel);
    this.avatar = { x: geo.avatarHome.x + 0.5, y: geo.avatarHome.y + 0.5, path: [], task: { type: 'idle' }, walkPhase: 0, facing: 1 };
    this.rebuildGrid();
    if (!state.objectives.length) refillObjectives(this);
    // Reprise d'une partie en cours de journée : les clients ne sont pas sauvegardés.
    if (state.phase === 'running' || state.phase === 'closing') {
      this.expectedToday = this.computeTraffic();
    }
  }

  static newGame(opts: { seed?: number; storeName?: string; mainColor?: string; headless?: boolean } = {}): GameEngine {
    return new GameEngine(createNewGame(opts), { headless: opts.headless });
  }

  // ------------------------------------------------------------------ évènements

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  emit(e: EngineEvent): void {
    if (this.headless && this.listeners.size === 0) return;
    for (const l of this.listeners) l(e);
  }

  touch(): void {
    this.version++;
    this.checkTutorial();
    for (const l of this.changeListeners) l();
  }

  log(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.state.log.push({ day: this.state.day, text, kind });
    if (this.state.log.length > 100) this.state.log.splice(0, this.state.log.length - 100);
  }

  serialize(): string {
    this.state.rngState = this.rng.state;
    return JSON.stringify(this.state);
  }

  // ------------------------------------------------------------------ utilitaires

  spend(amount: number, kind: 'marketing' | 'investments'): void {
    this.state.cash -= amount;
    this.state.today[kind] += amount;
  }

  addMarginXp(marginCents: number): void {
    if (marginCents <= 0) return;
    this.xpFraction += (marginCents / 100) * BALANCE.xpPerEuroMargin;
    const whole = Math.floor(this.xpFraction);
    if (whole > 0) {
      this.xpFraction -= whole;
      addXp(this, whole);
    }
  }

  rebuildGrid(): void {
    this.grid = buildGrid(this.state.storeLevel, this.state.furniture);
    this.pathCache.clear();
    this.refreshDerived();
    this.queues = geometry(this.state.storeLevel).checkouts.map((_, i) => this.queues[i] ?? []);
  }

  refreshDerived(): void {
    this.ambianceBonus = ambianceSatisfaction(this.state);
    this.distinctCache = distinctInStock(this.state);
    this.isSummer = dateInfo(this.state.day).season === 'ete';
  }

  furnitureByUid(uid: number): PlacedFurniture | undefined {
    return this.state.furniture.find((f) => f.uid === uid);
  }

  findPathCached(from: Point, to: Point): Point[] | null {
    const fx = Math.floor(from.x);
    const fy = Math.floor(from.y);
    const tx = Math.floor(to.x);
    const ty = Math.floor(to.y);
    const key = `${fx},${fy}>${tx},${ty}`;
    let p = this.pathCache.get(key);
    if (p === undefined) {
      p = findPath(this.grid, { x: fx, y: fy }, { x: tx, y: ty });
      if (this.pathCache.size > 4000) this.pathCache.clear();
      this.pathCache.set(key, p);
    }
    return p ? p.slice() : null;
  }

  isOpen(): boolean {
    const m = this.state.minute;
    return this.state.phase === 'running' && m >= BALANCE.openTime && m < BALANCE.closeTime;
  }

  // ------------------------------------------------------------------ fréquentation

  computeTraffic(): number {
    const s = this.state;
    const def = levelDef(s.storeLevel);
    const rep = BALANCE.repTrafficMin + (BALANCE.repTrafficMax - BALANCE.repTrafficMin) * (s.reputation / 100);
    const distinct = distinctInStock(s);
    const variety = Math.min(
      BALANCE.varietyMax,
      BALANCE.varietyMin + 0.5 * Math.sqrt(distinct / def.expectedVariety),
    );
    let upgrades = 1;
    if (s.upgrades.includes('sign1')) upgrades += 0.08;
    if (s.upgrades.includes('sign2')) upgrades += 0.12;
    if (s.upgrades.includes('loyalty')) upgrades += 0.07;
    if (s.upgrades.includes('app')) upgrades += 0.1;
    let mods = 1;
    for (const m of s.modifiers) if (m.type === 'traffic') mods *= 1 + m.value;
    const ambiance = 1 + Math.min(0.1, ambianceScore(s) / 300);
    // Les clients reviennent plus volontiers quand la qualité est bonne.
    const quality = 0.86 + 0.26 * (this.qualityIndex() / 100);
    return def.baseTraffic * rep * variety * upgrades * mods * ambiance * quality * campaignTraffic(s) * calendarTraffic(s.day);
  }

  /** Qualité moyenne de l'offre (pondérée par les ventes récentes). */
  qualityIndex(): number {
    const s = this.state;
    let w = 0;
    let q = 0;
    for (const id in s.products) {
      const ps = s.products[id];
      const sales = ps.recentSales.reduce((a, b) => a + b, 0);
      if (sales <= 0) continue;
      w += sales;
      q += sales * ps.avgQuality;
    }
    return w > 0 ? q / w : 60;
  }

  // ------------------------------------------------------------------ journée

  startDay(): Result {
    const s = this.state;
    if (s.phase !== 'prep') return fail('La journée est déjà commencée');
    if (s.pendingEvents.length) return fail('Un évènement attend votre décision');
    s.phase = 'running';
    this.expectedToday = this.computeTraffic();
    this.marketValueToday = 0;
    this.satisfactionSum = 0;
    this.satisfactionCount = 0;
    this.refreshDerived();
    this.touch();
    return OK;
  }

  /** Avance la simulation de `dt` minutes de jeu. */
  tick(dt: number): void {
    const s = this.state;
    if (s.phase !== 'running' && s.phase !== 'closing') return;
    let left = dt;
    while (left > 0 && (s.phase === 'running' || s.phase === 'closing')) {
      const step = Math.min(0.5, left);
      this.step(step);
      left -= step;
    }
  }

  /** Joue une journée complète sans rendu (tests, bot). */
  simulateDay(): void {
    if (this.state.phase === 'prep') this.startDay();
    let guard = 0;
    while ((this.state.phase === 'running' || this.state.phase === 'closing') && guard++ < 10000) this.tick(1);
  }

  private step(dt: number): void {
    const s = this.state;
    const prev = s.minute;
    s.minute += dt;
    if (prev < BALANCE.openTime && s.minute >= BALANCE.openTime) {
      this.emit({ type: 'storeOpen' });
      this.log('Le magasin ouvre ses portes.');
    }
    this.checkArrivals();

    // Réassort automatique : chaque heure, le gérant remplit les rayons depuis la réserve.
    if (Math.floor(prev / 60) !== Math.floor(s.minute / 60) && s.phase === 'running') {
      const touched = restockFromReserve(s);
      for (const uid of touched) this.emit({ type: 'shelfFilled', uid });
    }

    if (this.isOpen()) {
      const hour = Math.min(11, Math.max(0, Math.floor((s.minute - BALANCE.openTime) / 60)));
      const weights = BALANCE.hourlyTraffic;
      const sum = weights.reduce((a, b) => a + b, 0);
      const lambda = (this.expectedToday * weights[hour]) / sum / 60 * dt;
      const n = this.rng.poisson(lambda);
      for (let i = 0; i < n; i++) this.spawnCustomer();
    }

    if (s.phase === 'running' && s.minute >= BALANCE.closeTime) {
      s.phase = 'closing';
      this.emit({ type: 'storeClose' });
      for (const c of this.customers) {
        if (c.phase === 'walking' || c.phase === 'browsing' || c.phase === 'entering') {
          c.wantIndex = c.wants.length;
          if (c.phase !== 'entering') this.goCheckout(c);
        }
      }
    }

    for (const c of this.customers) this.updateCustomer(c, dt);
    this.processQueues(dt);
    if (this.customers.some((c) => c.phase === 'gone')) this.customers = this.customers.filter((c) => c.phase !== 'gone');

    if (++this.liveCounter % 20 === 0) {
      this.distinctCache = distinctInStock(s);
      updateObjectivesLive(this);
      this.touch();
    }

    if (s.phase === 'closing' && (this.customers.length === 0 || s.minute > BALANCE.closeTime + 120)) {
      for (const c of this.customers) if (c.phase !== 'gone' && c.phase !== 'leaving') this.leaveStats(c);
      this.customers = [];
      this.queues = this.queues.map(() => []);
      this.endDay();
    }
  }

  private checkArrivals(): void {
    const s = this.state;
    for (const o of s.orders) {
      if (o.status !== 'transit') continue;
      if (o.arrivalDay < s.day || (o.arrivalDay === s.day && o.arrivalMinute <= s.minute)) {
        o.status = 'arrived';
        this.emit({ type: 'truckArrived', orderId: o.id });
        this.log(`Livraison de ${SUPPLIER_MAP[o.supplierId].name} arrivée.`, 'info');
        this.touch();
      }
    }
  }

  endDay(): void {
    const s = this.state;
    const t = s.today;
    // Livraisons non récupérées : déposées en réserve par le livreur.
    for (const o of s.orders) {
      if (o.status === 'arrived') {
        this.receiveDelivery(o.id, true);
        this.log(`Livraison n°${o.id} déposée à la réserve après la fermeture.`);
      }
    }
    this.pickupQueue = [];
    const ch = dailyCharges(s, t.revenue);
    s.cash -= ch.total;
    t.charges = ch.total - ch.taxes;
    t.taxes = ch.taxes;
    t.profit = t.revenue - t.cogs - t.marketing - t.charges - t.taxes;
    t.priceIndex = this.marketValueToday > 0 ? t.revenue / this.marketValueToday : 1;
    const sat = this.satisfactionCount ? this.satisfactionSum / this.satisfactionCount : s.reputation;
    t.satisfaction = sat;

    // Réputation : dérive lente vers la satisfaction moyenne, pondérée par la qualité perçue de l'offre.
    const target = sat * 0.8 + this.qualityIndex() * 0.2;
    let delta = (target - s.reputation) * BALANCE.reputationDriftRate * Math.min(1, t.customers / 25);
    if (delta < 0 && s.upgrades.includes('loyalty')) delta *= 0.7;
    delta = Math.max(-BALANCE.reputationMaxDailyChange, Math.min(BALANCE.reputationMaxDailyChange, delta));
    // Le marketing aide la réputation, mais ne peut pas la porter bien au-delà de la satisfaction réelle.
    let bonus = 0;
    for (const c of s.campaigns) bonus += CAMPAIGN_MAP[c.id]?.repPerDay ?? 0;
    if (s.upgrades.includes('app')) bonus += 0.05;
    delta += bonus * Math.max(0, 1 - Math.max(0, s.reputation - target) / 8);
    s.reputation = Math.max(0, Math.min(100, s.reputation + delta));
    t.repEnd = s.reputation;

    let best: string | null = null;
    let bestQty = 0;
    for (const id in t.productUnits) {
      if (t.productUnits[id] > bestQty) {
        bestQty = t.productUnits[id];
        best = id;
      }
    }
    t.bestProduct = best;
    t.bestProductQty = bestQty;
    t.cashEnd = s.cash;

    for (const id in s.products) {
      const ps = s.products[id];
      if (ps.soldToday > 0 || ps.recentSales.length || totalStock(s, id) > 0) {
        ps.recentSales.push(ps.soldToday);
        if (ps.recentSales.length > 7) ps.recentSales.shift();
      }
      ps.popularity += (1 - ps.popularity) * BALANCE.popularityDecay;
    }

    s.totalProfit += t.profit;
    if (t.profit > 0 && t.customers > 0) s.lifetime.profitableDays++;
    s.history.push(t);
    if (s.history.length > 400) s.history.shift();

    // Faillite : trésorerie très négative pendant longtemps.
    if (s.cash < -BALANCE.bankruptcyThresholdPerLevel * s.storeLevel) {
      s.negativeDays++;
      if (s.negativeDays >= BALANCE.bankruptcyDays) {
        s.bankrupt = true;
        this.emit({ type: 'bankrupt' });
      } else {
        this.log(`Trésorerie critique ! Faillite dans ${BALANCE.bankruptcyDays - s.negativeDays} jours si rien ne change.`, 'bad');
      }
    } else {
      s.negativeDays = 0;
    }

    updateObjectivesEndOfDay(this);
    checkMilestones(this);
    s.phase = 'report';
    s.minute = BALANCE.closeTime;
    this.emit({ type: 'dayEnd', record: t });
    this.touch();
  }

  nextDay(): Result {
    const s = this.state;
    if (s.phase !== 'report') return fail('La journée n’est pas terminée');
    if (s.bankrupt) return fail('Faillite');
    s.day++;
    s.minute = BALANCE.dayStart;
    s.phase = 'prep';

    s.campaigns = s.campaigns.filter((c) => --c.daysLeft > 0);
    s.promotions = s.promotions.filter((p) => --p.daysLeft > 0);
    s.modifiers = s.modifiers.filter((m) => --m.daysLeft > 0);

    for (const id in s.products) {
      s.products[id].soldToday = 0;
      s.products[id].stockoutsToday = 0;
    }
    s.today = emptyDayRecord(s.day, s.reputation, s.cash);

    // Réassort du matin : le joueur remplit ses rayons avant l'ouverture.
    const touched = restockFromReserve(s);
    for (const uid of touched) this.emit({ type: 'shelfFilled', uid });

    this.checkArrivals();

    if (isMonthStart(s.day)) {
      const records = s.history.slice(-14);
      const marketingDays = records.filter((r) => r.marketing > 0).length;
      const variety = distinctInStock(s) / levelDef(s.storeLevel).expectedVariety;
      const report = computeMarketReport(s, records, this.rng, variety, marketingDays);
      s.marketShare = report.playerShare;
      s.marketReports.push(report);
      if (s.marketReports.length > 36) s.marketReports.shift();
      this.emit({ type: 'monthReport', report });
      checkMilestones(this);
    }

    const ev = rollRandomEvent(this);
    if (ev) {
      s.pendingEvents.push(ev);
      this.emit({ type: 'gameEvent', event: ev });
    }

    // Historique des commandes limité
    const done = s.orders.filter((o) => o.status === 'received');
    if (done.length > 60) {
      const remove = new Set(done.slice(0, done.length - 60).map((o) => o.id));
      s.orders = s.orders.filter((o) => !remove.has(o.id));
    }
    refillObjectives(this);
    this.refreshDerived();
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ clients

  private spawnCustomer(): void {
    const s = this.state;
    const c = createCustomer(this);
    if (!c) return;
    s.today.customers++;
    s.lifetime.customers++;
    const def = levelDef(s.storeLevel);
    if (this.customers.length >= def.maxVisible) {
      this.shopVirtually(c);
      return;
    }
    const geo = geometry(s.storeLevel);
    c.path = [
      { x: geo.doorX + 0.5, y: geo.h + 0.4 },
      { x: geo.doorX + 0.5, y: geo.h - 0.5 },
    ];
    this.customers.push(c);
  }

  /** Client simulé sans affichage (quand trop de clients sont déjà visibles). */
  private shopVirtually(c: Customer): void {
    let i = 0;
    while (i < c.wants.length) {
      const uid = c.wants[i].furnitureUid;
      const f = this.furnitureByUid(uid);
      while (i < c.wants.length && c.wants[i].furnitureUid === uid) {
        if (f) considerProduct(this, c, f, c.wants[i].productId, false);
        i++;
      }
      if (f) this.impulse(c, f);
    }
    this.leaveStats(c);
  }

  private leaveStats(c: Customer): void {
    const sat = finalizeSatisfaction(this, c);
    this.satisfactionSum += sat;
    this.satisfactionCount++;
    if (c.items.length) this.state.today.buyers++;
  }

  private moveAlong(c: { x: number; y: number; path: Point[]; facing: number; walkPhase: number }, dist: number): boolean {
    let left = dist;
    while (left > 0 && c.path.length) {
      const t = c.path[0];
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) c.facing = dx > 0 ? 1 : -1;
      if (d <= left) {
        c.x = t.x;
        c.y = t.y;
        c.path.shift();
        left -= d;
      } else {
        c.x += (dx / d) * left;
        c.y += (dy / d) * left;
        left = 0;
      }
    }
    c.walkPhase += dist * 2.2;
    return c.path.length === 0;
  }

  private updateCustomer(c: Customer, dt: number): void {
    switch (c.phase) {
      case 'entering':
        if (this.moveAlong(c, c.speed * dt)) {
          if (this.state.minute - this.lastDoorSound > 3) {
            this.lastDoorSound = this.state.minute;
            this.emit({ type: 'door' });
          }
          if (this.state.phase === 'closing') this.goCheckout(c);
          else this.goToNextWant(c);
        }
        break;
      case 'walking':
        if (this.moveAlong(c, c.speed * dt)) {
          c.phase = 'browsing';
          c.timer = this.rng.range(BALANCE.browseMinutes[0], BALANCE.browseMinutes[1]);
          const f = this.furnitureByUid(c.wants[c.wantIndex]?.furnitureUid ?? -1);
          if (f) c.facing = f.x + 0.5 > c.x ? 1 : -1;
        }
        break;
      case 'browsing':
        c.timer -= dt;
        if (c.timer <= 0) {
          this.processShelf(c);
          this.goToNextWant(c);
        }
        break;
      case 'toCheckout':
        if (this.moveAlong(c, c.speed * dt)) {
          c.phase = 'queue';
          if (!this.queues[c.checkout]) this.queues[c.checkout] = [];
          this.queues[c.checkout].push(c.id);
        }
        break;
      case 'queue':
        c.waited += dt;
        if (c.path.length) this.moveAlong(c, c.speed * dt);
        break;
      case 'paying':
        c.timer -= dt;
        if (c.path.length) this.moveAlong(c, c.speed * dt);
        break;
      case 'leaving':
        if (this.moveAlong(c, c.speed * 1.1 * dt)) c.phase = 'gone';
        break;
      default:
        break;
    }
  }

  private processShelf(c: Customer): void {
    const want = c.wants[c.wantIndex];
    if (!want) return;
    const uid = want.furnitureUid;
    const f = this.furnitureByUid(uid);
    let reaction: Reaction = null;
    while (c.wantIndex < c.wants.length && c.wants[c.wantIndex].furnitureUid === uid) {
      if (f) {
        const r = considerProduct(this, c, f, c.wants[c.wantIndex].productId, false);
        if (r && !reaction) reaction = r;
      }
      c.wantIndex++;
    }
    if (f) this.impulse(c, f);
    if (reaction) this.react(c, reaction);
  }

  private impulse(c: Customer, f: PlacedFurniture): void {
    const others = f.slots.filter((sl) => sl.productId && sl.qty > 0 && !c.items.some((it) => it.productId === sl.productId));
    if (!others.length) return;
    const slot = this.rng.pick(others);
    considerProduct(this, c, f, slot.productId!, true);
  }

  private react(c: Customer, r: NonNullable<Reaction>): void {
    if (this.state.minute - this.lastReactionMinute < 5) return;
    this.lastReactionMinute = this.state.minute;
    this.emit({ type: 'reaction', customerId: c.id, text: r.text, mood: r.mood });
  }

  private goToNextWant(c: Customer): void {
    while (c.wantIndex < c.wants.length) {
      const f = this.furnitureByUid(c.wants[c.wantIndex].furnitureUid);
      if (f) {
        const cells = accessCells(f, this.grid);
        let best: Point[] | null = null;
        for (const cell of cells) {
          const p = this.findPathCached(c, cell);
          if (p && (!best || p.length < best.length)) best = p;
          if (best && best.length <= 1) break;
        }
        if (best) {
          c.path = best;
          c.phase = 'walking';
          if (!best.length) {
            c.phase = 'browsing';
            c.timer = this.rng.range(BALANCE.browseMinutes[0], BALANCE.browseMinutes[1]);
          }
          return;
        }
      }
      c.wantIndex++;
    }
    this.goCheckout(c);
  }

  private goCheckout(c: Customer): void {
    const geo = geometry(this.state.storeLevel);
    if (!c.items.length) {
      this.leave(c);
      return;
    }
    let bestI = 0;
    let bestScore = Infinity;
    geo.payCells.forEach((cell, i) => {
      const q = this.queues[i]?.length ?? 0;
      const inbound = this.customers.filter((o) => o.phase === 'toCheckout' && o.checkout === i).length;
      const score = (q + inbound) * 4 + Math.abs(cell.x - c.x) * 0.3;
      if (score < bestScore) {
        bestScore = score;
        bestI = i;
      }
    });
    c.checkout = bestI;
    const cell = geo.payCells[bestI];
    const p = this.findPathCached(c, cell) ?? [{ x: cell.x + 0.5, y: cell.y + 0.5 }];
    c.path = p;
    c.phase = 'toCheckout';
  }

  private leave(c: Customer): void {
    const geo = geometry(this.state.storeLevel);
    const door = { x: geo.doorX, y: geo.h - 1 };
    const p = this.findPathCached(c, door) ?? [];
    p.push({ x: geo.doorX + 0.5, y: geo.h + 0.4 }, { x: geo.doorX + 0.5 + this.rng.range(-2, 2), y: geo.h + 1.8 });
    c.path = p;
    c.phase = 'leaving';
    this.leaveStats(c);
    const sat = finalizeSatisfaction(this, c);
    if (c.items.length && sat > 80 && this.rng.chance(0.25)) this.react(c, { text: "J'aime bien ce magasin !", mood: 'good' });
    else if (!c.items.length && c.wants.length === 0 && this.rng.chance(0.2)) this.react(c, { text: 'Rien pour moi ici…', mood: 'neutral' });
  }

  private payTime(c: Customer, checkoutIndex: number): number {
    const s = this.state;
    const items = c.items.reduce((a, it) => a + it.qty, 0);
    let t = BALANCE.payBaseMinutes + BALANCE.payPerItemMinutes * items;
    if (s.upgrades.includes('fast_checkout')) t *= 0.7;
    if (s.upgrades.includes('fast_checkout2')) t *= 0.7;
    if (checkoutIndex > 0) t *= BALANCE.selfCheckoutSlowdown;
    return t;
  }

  private processQueues(_dt: number): void {
    const geo = geometry(this.state.storeLevel);
    const byId = new Map(this.customers.map((c) => [c.id, c]));
    this.queues.forEach((q, i) => {
      const cell = geo.payCells[i];
      if (!cell) return;
      // retirer les clients disparus
      for (let k = q.length - 1; k >= 0; k--) if (!byId.has(q[k])) q.splice(k, 1);
      const head = q.length ? byId.get(q[0]) : undefined;
      if (head) {
        if (head.phase === 'queue') {
          head.phase = 'paying';
          head.timer = this.payTime(head, i);
          head.path = [{ x: cell.x + 0.5, y: cell.y + 0.5 }];
        } else if (head.phase === 'paying' && head.timer <= 0) {
          q.shift();
          this.emit({ type: 'pay', x: cell.x + 0.5, y: cell.y + 0.5, amount: head.spent });
          this.leave(head);
        }
      }
      // positions d'attente
      const dir = cell.x < geo.doorX ? -1 : 1;
      for (let k = 1; k < q.length; k++) {
        const c = byId.get(q[k]);
        if (!c || c.phase !== 'queue') continue;
        let x = cell.x + 0.5 + dir * 0.75 * k;
        let y = cell.y + 0.5;
        if (x < 0.35 || x > geo.w - 0.35) {
          const over = x < 0.35 ? (0.35 - x) / 0.75 : (x - (geo.w - 0.35)) / 0.75;
          x = Math.max(0.35, Math.min(geo.w - 0.35, x));
          y -= 0.6 * Math.ceil(over);
        }
        c.path = Math.hypot(c.x - x, c.y - y) > 0.05 ? [{ x, y }] : [];
      }
    });
  }

  /** Recalcule les trajets après une modification de l'aménagement. */
  private rerouteCustomers(): void {
    for (const c of this.customers) {
      if (c.phase === 'walking' || c.phase === 'browsing') {
        this.goToNextWant(c);
      } else if (c.phase === 'toCheckout') {
        this.goCheckout(c);
      } else if (c.phase === 'leaving') {
        const geo = geometry(this.state.storeLevel);
        const p = this.findPathCached(c, { x: geo.doorX, y: geo.h - 1 }) ?? [];
        p.push({ x: geo.doorX + 0.5, y: geo.h + 1.8 });
        c.path = p;
      }
    }
  }

  // ------------------------------------------------------------------ avatar & livraisons

  requestPickup(orderId?: number): number {
    const s = this.state;
    const ids = s.orders
      .filter((o) => o.status === 'arrived' && (orderId === undefined || o.id === orderId))
      .map((o) => o.id)
      .filter((id) => !this.pickupQueue.includes(id) && !this.avatarBusyWith(id));
    this.pickupQueue.push(...ids);
    this.touch();
    return ids.length;
  }

  private avatarBusyWith(id: number): boolean {
    const t = this.avatar.task;
    return (t.type === 'toTruck' || t.type === 'carrying' || t.type === 'opening') && t.orderId === id;
  }

  /** Mise à jour de l'avatar en temps réel (fonctionne aussi en pause). */
  tickAvatar(dtSeconds: number): void {
    const a = this.avatar;
    const geo = geometry(this.state.storeLevel);
    const speed = 3.4 * dtSeconds;
    const home = { x: geo.avatarHome.x + 0.5, y: geo.avatarHome.y + 0.5 };
    const aisle = geo.h - 1.5;
    const doorX = geo.doorX + 0.5;
    const inside = { x: Math.min(geo.w - 0.5, doorX + 1), y: aisle };
    const outside = { x: doorX, y: geo.h + 0.9 };
    const truck = { x: geo.truckSpot.x - 1.6, y: geo.truckSpot.y - 0.35 };
    const t = a.task;
    switch (t.type) {
      case 'idle': {
        const next = this.pickupQueue.shift();
        if (next !== undefined) {
          const o = this.state.orders.find((x) => x.id === next);
          if (o && o.status === 'arrived') {
            a.task = { type: 'toTruck', orderId: next };
            a.path = [];
            if (Math.abs(a.y - aisle) > 0.1) a.path.push({ x: a.x, y: aisle });
            a.path.push({ x: doorX, y: aisle }, outside, truck);
          }
        } else if (Math.hypot(a.x - home.x, a.y - home.y) > 0.05 && !a.path.length) {
          a.path = [{ x: home.x, y: aisle }, home];
        }
        if (a.path.length) this.moveAlong(a, speed);
        break;
      }
      case 'toTruck':
        if (this.moveAlong(a, speed)) {
          a.task = { type: 'carrying', orderId: t.orderId };
          a.path = [outside, { x: doorX, y: aisle }, inside];
          this.touch();
        }
        break;
      case 'carrying':
        if (this.moveAlong(a, speed * 0.85)) {
          a.task = { type: 'opening', orderId: t.orderId, timer: 0.7 };
          this.touch();
        }
        break;
      case 'opening':
        t.timer -= dtSeconds;
        if (t.timer <= 0) {
          this.receiveDelivery(t.orderId);
          const next = this.pickupQueue.shift();
          const o = next !== undefined ? this.state.orders.find((x) => x.id === next) : undefined;
          if (o && o.status === 'arrived') {
            a.task = { type: 'toTruck', orderId: o.id };
            a.path = [{ x: doorX, y: aisle }, outside, truck];
          } else {
            a.task = { type: 'return' };
            a.path = [{ x: home.x, y: aisle }, home];
          }
        }
        break;
      case 'return':
        if (this.moveAlong(a, speed)) a.task = { type: 'idle' };
        break;
    }
  }

  /** Réception immédiate (bot / tests / fermeture). */
  receiveDeliveryNow(orderId: number): Result {
    const o = this.state.orders.find((x) => x.id === orderId);
    if (!o || o.status !== 'arrived') return fail('Aucune livraison à réceptionner');
    this.receiveDelivery(orderId);
    return OK;
  }

  private receiveDelivery(orderId: number, silent = false): void {
    const s = this.state;
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || o.status !== 'arrived') return;
    o.status = 'received';
    o.receivedDay = s.day;
    let shelved = 0;
    let reserved = 0;
    const touched = new Set<number>();
    // les produits les moins flexibles (ex. frais → frigo) sont rangés en premier
    const flex = (pid: string) => s.furniture.filter((f) => canHold(f, pid)).length;
    const lines = [...o.lines].sort((a, b) => flex(a.productId) - flex(b.productId));
    for (const line of lines) {
      const ps = s.products[line.productId];
      const current = totalStock(s, line.productId);
      addToInventory(ps, line.qty, line.unitCost, line.quality, current);
      ps.lastSupplier = o.supplierId;
      const placed = shelveUnits(s, line.productId, line.qty, true, touched);
      shelved += placed;
      reserved += line.qty - placed;
      ps.reserve += line.qty - placed;
    }
    this.distinctCache = distinctInStock(s);
    for (const uid of touched) this.emit({ type: 'shelfFilled', uid });
    this.emit({ type: 'deliveryReceived', orderId, shelved, reserved });
    if (!silent) {
      this.log(
        `Livraison réceptionnée : ${shelved} en rayon${reserved ? `, ${reserved} en réserve` : ''}.`,
        reserved ? 'info' : 'good',
      );
    }
    this.touch();
  }

  // ------------------------------------------------------------------ commandes

  placeOrder(supplierId: string, lines: { productId: string; qty: number }[]): Result & { orderId?: number } {
    const s = this.state;
    const sup = SUPPLIER_MAP[supplierId];
    if (!sup) return fail('Fournisseur inconnu');
    if (s.level < sup.unlockLevel) return fail('Fournisseur non débloqué');
    const catalog = new Set(supplierCatalog(s, supplierId));
    const clean = lines.filter((l) => l.qty > 0);
    if (!clean.length) return fail('Commande vide');
    for (const l of clean) {
      if (!catalog.has(l.productId) || !isProductUnlocked(s, l.productId)) return fail(`${PRODUCT_MAP[l.productId]?.name ?? l.productId} indisponible chez ce fournisseur`);
      if (!Number.isInteger(l.qty) || l.qty > 5000) return fail('Quantité invalide');
    }
    const orderLines = clean.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      unitCost: supplierUnitCost(s, supplierId, l.productId),
      quality: supplierQuality(supplierId, l.productId),
    }));
    const total = orderLines.reduce((a, l) => a + l.unitCost * l.qty, 0);
    if (total < sup.minOrder) return fail(`Commande minimum : ${euros(sup.minOrder)}`);
    if (total > s.cash) return fail('Trésorerie insuffisante');
    const arrival = computeArrival(s, supplierId);
    const order: Order = {
      id: s.nextOrderId++,
      supplierId,
      lines: orderLines,
      total,
      placedDay: s.day,
      placedMinute: s.minute,
      arrivalDay: arrival.day,
      arrivalMinute: arrival.minute,
      status: 'transit',
    };
    s.cash -= total;
    s.today.purchases += total;
    s.orders.push(order);
    this.log(`Commande n°${order.id} passée chez ${sup.name} (${euros(total)}).`);
    this.touch();
    return { ok: true, orderId: order.id };
  }

  // ------------------------------------------------------------------ aménagement

  buyFurniture(defId: string, x: number, y: number, rot: 0 | 1 = 0): Result & { uid?: number } {
    const s = this.state;
    const def = FURNITURE_MAP[defId];
    if (!def) return fail('Meuble inconnu');
    if (s.level < def.unlockLevel) return fail(`Débloqué au niveau ${def.unlockLevel}`);
    if (def.requiresUpgrade && !s.upgrades.includes(def.requiresUpgrade)) return fail(`Nécessite l’amélioration « ${UPGRADE_MAP[def.requiresUpgrade].name} »`);
    if (s.cash < def.cost) return fail('Trésorerie insuffisante');
    const err = validatePlacement(s.storeLevel, s.furniture, { defId, x, y, rot });
    if (err) return fail(PLACEMENT_MESSAGES[err]);
    const f: PlacedFurniture = {
      uid: s.nextUid++,
      defId,
      x,
      y,
      rot,
      slots: Array.from({ length: def.slots ?? 0 }, () => ({ productId: null, qty: 0 })),
    };
    s.furniture.push(f);
    this.spend(def.cost, 'investments');
    this.rebuildGrid();
    this.rerouteCustomers();
    // Remplir immédiatement avec la réserve si possible
    if (def.kind === 'shelf') {
      const touched = restockFromReserve(s);
      for (const uid of touched) this.emit({ type: 'shelfFilled', uid });
    }
    updateObjectivesLive(this);
    this.touch();
    return { ok: true, uid: f.uid };
  }

  moveFurniture(uid: number, x: number, y: number, rot: 0 | 1): Result {
    const s = this.state;
    const f = this.furnitureByUid(uid);
    if (!f) return fail('Meuble introuvable');
    const err = validatePlacement(s.storeLevel, s.furniture, { defId: f.defId, x, y, rot }, uid);
    if (err) return fail(PLACEMENT_MESSAGES[err]);
    f.x = x;
    f.y = y;
    f.rot = rot;
    this.rebuildGrid();
    this.rerouteCustomers();
    this.touch();
    return OK;
  }

  sellFurniture(uid: number): Result & { refund?: number } {
    const s = this.state;
    const f = this.furnitureByUid(uid);
    if (!f) return fail('Meuble introuvable');
    const def = FURNITURE_MAP[f.defId];
    emptyFurniture(s, f);
    s.furniture = s.furniture.filter((x) => x.uid !== uid);
    const refund = Math.round(def.cost * BALANCE.resellRatio);
    s.cash += refund;
    s.today.investments -= refund;
    this.rebuildGrid();
    this.rerouteCustomers();
    restockFromReserve(s);
    this.touch();
    return { ok: true, refund };
  }

  assignSlot(uid: number, slotIndex: number, productId: string | null): Result {
    const s = this.state;
    const f = this.furnitureByUid(uid);
    if (!f || !f.slots[slotIndex]) return fail('Emplacement introuvable');
    if (productId) {
      if (!isProductUnlocked(s, productId)) return fail('Produit non débloqué');
      if (!canHold(f, productId)) return fail('Ce rayon ne peut pas accueillir ce produit');
    }
    const slot = f.slots[slotIndex];
    if (slot.productId && slot.qty > 0) s.products[slot.productId].reserve += slot.qty;
    slot.qty = 0;
    slot.productId = productId;
    if (productId) {
      const ps = s.products[productId];
      const placed = shelveUnits(s, productId, ps.reserve, false);
      ps.reserve -= placed;
      if (placed) this.emit({ type: 'shelfFilled', uid });
    }
    this.distinctCache = distinctInStock(s);
    this.touch();
    return OK;
  }

  restock(): number {
    const touched = restockFromReserve(this.state);
    for (const uid of touched) this.emit({ type: 'shelfFilled', uid });
    this.distinctCache = distinctInStock(this.state);
    this.touch();
    return touched.size;
  }

  setPrice(productId: string, price: number): Result {
    const def = PRODUCT_MAP[productId];
    if (!def) return fail('Produit inconnu');
    const p = Math.round(price);
    if (!Number.isFinite(p) || p < 1) return fail('Prix invalide');
    this.state.products[productId].price = Math.min(p, def.marketPrice * 5);
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ marketing

  launchCampaign(id: string): Result {
    const s = this.state;
    const def = CAMPAIGN_MAP[id];
    if (!def) return fail('Campagne inconnue');
    if (s.level < def.unlockLevel) return fail(`Débloquée au niveau ${def.unlockLevel}`);
    if (s.campaigns.some((c) => c.id === id)) return fail('Campagne déjà en cours');
    if (s.cash < def.cost) return fail('Trésorerie insuffisante');
    this.spend(def.cost, 'marketing');
    // Une campagne lancée avant l'ouverture compte dès aujourd'hui.
    s.campaigns.push({ id, daysLeft: def.days, totalDays: def.days });
    s.lifetime.campaigns++;
    if (s.phase === 'running') this.expectedToday = this.computeTraffic();
    this.log(`Campagne « ${def.name} » lancée pour ${def.days} jours.`, 'good');
    updateObjectivesLive(this);
    this.touch();
    return OK;
  }

  createPromotion(scope: PromoScope, target: string | null, discount: number, days: number): Result {
    const s = this.state;
    if (![0.1, 0.2, 0.3].includes(discount)) return fail('Remise invalide');
    if (days < 1 || days > 14) return fail('Durée invalide');
    if (scope !== 'store' && !target) return fail('Cible manquante');
    if (scope === 'product' && !PRODUCT_MAP[target!]) return fail('Produit inconnu');
    if (scope === 'category' && !CATEGORY_MAP[target as keyof typeof CATEGORY_MAP]) return fail('Catégorie inconnue');
    s.promotions = s.promotions.filter((p) => !(p.scope === scope && p.target === (scope === 'store' ? null : target)));
    if (s.promotions.length >= 6) return fail('6 promotions maximum en même temps');
    s.promotions.push({ id: s.nextPromoId++, scope, target: scope === 'store' ? null : target, discount, daysLeft: days });
    this.touch();
    return OK;
  }

  cancelPromotion(id: number): Result {
    this.state.promotions = this.state.promotions.filter((p) => p.id !== id);
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ améliorations & agrandissement

  buyUpgrade(id: string): Result {
    const s = this.state;
    const def = UPGRADE_MAP[id];
    if (!def) return fail('Amélioration inconnue');
    if (s.upgrades.includes(id)) return fail('Déjà acquise');
    if (s.level < def.unlockLevel) return fail(`Débloquée au niveau ${def.unlockLevel}`);
    if (s.storeLevel < def.minStoreLevel) return fail(`Nécessite un magasin de niveau ${def.minStoreLevel}`);
    if (def.requires && !s.upgrades.includes(def.requires)) return fail(`Nécessite « ${UPGRADE_MAP[def.requires].name} »`);
    if (s.cash < def.cost) return fail('Trésorerie insuffisante');
    this.spend(def.cost, 'investments');
    s.upgrades.push(id);
    if (id === 'premium_shelves') restockFromReserve(s);
    this.refreshDerived();
    this.log(`Amélioration « ${def.name} » installée.`, 'good');
    this.emit({ type: 'unlock', text: `${def.icon} ${def.name}` });
    this.touch();
    return OK;
  }

  canExpand(): Result {
    const s = this.state;
    const next = STORE_LEVELS[s.storeLevel];
    if (!next) return fail('Taille maximale atteinte');
    if (s.level < next.requiredLevel) return fail(`Niveau ${next.requiredLevel} requis`);
    if (s.cash < next.cost) return fail('Trésorerie insuffisante');
    if (s.phase === 'running' || s.phase === 'closing') return fail('Les travaux se font magasin fermé (avant l’ouverture ou après la fermeture)');
    return OK;
  }

  expandStore(): Result {
    const check = this.canExpand();
    if (!check.ok) return check;
    const s = this.state;
    const next = STORE_LEVELS[s.storeLevel];
    const { dx, dy } = expansionOffset(s.storeLevel, next.level);
    for (const f of s.furniture) {
      f.x += dx;
      f.y += dy;
    }
    this.spend(next.cost, 'investments');
    s.storeLevel = next.level;
    const cats = refreshCategoryUnlocks(s);
    for (const c of cats) this.emit({ type: 'unlock', text: `${CATEGORY_MAP[c].icon} Nouvelle catégorie : ${CATEGORY_MAP[c].name}` });
    const geo = geometry(s.storeLevel);
    this.avatar.x = geo.avatarHome.x + 0.5;
    this.avatar.y = geo.avatarHome.y + 0.5;
    this.avatar.path = [];
    this.queues = [];
    this.rebuildGrid();
    this.log(`Agrandissement terminé : ${next.name} !`, 'good');
    this.emit({ type: 'expansion', level: s.storeLevel });
    checkMilestones(this);
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ personnalisation

  setStoreName(name: string): Result {
    const n = name.trim().slice(0, 24);
    if (!n) return fail('Nom vide');
    this.state.customization.storeName = n;
    this.touch();
    return OK;
  }

  setMainColor(color: string): Result {
    this.state.customization.mainColor = color;
    this.touch();
    return OK;
  }

  buyStyle(kind: 'floor' | 'wall' | 'sign', id: number): Result {
    const s = this.state;
    const c = s.customization;
    const list = kind === 'floor' ? FLOOR_STYLES : kind === 'wall' ? WALL_STYLES : SIGN_STYLES;
    const owned = kind === 'floor' ? c.ownedFloors : kind === 'wall' ? c.ownedWalls : c.ownedSigns;
    const def = list.find((x) => x.id === id);
    if (!def) return fail('Style inconnu');
    if (!owned.includes(id)) {
      if (s.level < def.unlockLevel) return fail(`Débloqué au niveau ${def.unlockLevel}`);
      if (s.cash < def.cost) return fail('Trésorerie insuffisante');
      this.spend(def.cost, 'investments');
      owned.push(id);
    }
    if (kind === 'floor') c.floorStyle = id;
    else if (kind === 'wall') c.wallStyle = id;
    else c.signStyle = id;
    this.refreshDerived();
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ évènements aléatoires

  resolveEvent(eventId: number, choice: number): Result {
    const s = this.state;
    const ev = s.pendingEvents.find((e) => e.id === eventId);
    if (!ev) return fail('Évènement introuvable');
    const err = applyEventChoice(this, ev, choice);
    if (err) return fail(err);
    s.pendingEvents = s.pendingEvents.filter((e) => e.id !== eventId);
    this.log(`${ev.title} : ${ev.choices[choice]?.label ?? ''}`);
    this.touch();
    return OK;
  }

  // ------------------------------------------------------------------ tutoriel

  tutorialFlags = { stockOpened: false };

  tutorialSignal(flag: 'stockOpened'): void {
    this.tutorialFlags[flag] = true;
    this.touch();
  }

  skipTutorial(): void {
    this.state.tutorial = { active: false, step: TUTORIAL_STEPS.length, done: true };
    this.touch();
  }

  private checkTutorial(): void {
    const t = this.state.tutorial;
    if (!t.active || t.done) return;
    const s = this.state;
    const shelves = s.furniture.filter((f) => FURNITURE_MAP[f.defId].kind === 'shelf');
    const conds: (() => boolean)[] = [
      () => shelves.length > 0,
      () => shelves.some((f) => f.defId === 'frigo' || f.defId === 'frigo_xl'),
      () => s.orders.length > 0,
      () => s.phase !== 'prep' || s.day > 1,
      () => s.orders.some((o) => o.status === 'received'),
      () => this.tutorialFlags.stockOpened,
      () => s.today.itemsSold >= 3 || s.day > 1,
      () => s.day > 1,
    ];
    let guard = 0;
    while (t.step < conds.length && conds[t.step]() && guard++ < 10) t.step++;
    if (t.step >= conds.length) {
      t.done = true;
      t.active = false;
    }
  }
}
