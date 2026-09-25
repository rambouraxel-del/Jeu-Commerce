// Contrôleur d'interface : relie le moteur, le rendu Canvas, l'audio et React.

import { audio } from '../audio/audio';
import { SEGMENT_MAP } from '../data/customers';
import { FURNITURE_MAP } from '../data/furniture';
import { MILESTONE_MAP } from '../data/progression';
import { BALANCE } from '../game/constants';
import { GameEngine } from '../game/engine';
import { findFreeSpot, footprint, geometry, PLACEMENT_MESSAGES, validatePlacement } from '../game/store/layout';
import type { DayRecord, EngineEvent, MarketReport } from '../game/types';
import { Renderer, type BuildView } from '../rendering/renderer';
import { saveGame } from '../save/save';
import { euros } from '../utils/format';

export type Tab = 'store' | 'stock' | 'computer' | 'finances' | 'manage';
export type Speed = 0 | 1 | 2 | 4;

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad';
  ttl: number;
}

export interface ConfirmState {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface BuildState extends BuildView {
  message: string | null;
}

export class GameController {
  engine: GameEngine;
  renderer: Renderer | null = null;
  version = 0;
  speed: Speed = 0;
  tab: Tab = 'store';
  computerTab = 'suppliers';
  manageTab = 'objectives';
  build: BuildState = { active: false, ghost: null, selectedUid: null, message: null };
  toasts: Toast[] = [];
  shelfSheet: number | null = null;
  productSheet: string | null = null;
  orderDraft: { supplierId: string; lines: Record<string, number> } | null = null;
  confirm: ConfirmState | null = null;
  levelUps: { level: number; unlocks: string[] }[] = [];
  monthReports: MarketReport[] = [];
  expansionShown: number | null = null;
  reportDismissed = false;
  lastDayRecord: DayRecord | null = null;
  onExit: (() => void) | null = null;
  noSave = false;
  objectivesOpen = false;

  private listeners = new Set<() => void>();
  private raf = 0;
  private lastTime = 0;
  private toastId = 1;
  private saveTimer = 0;
  private unsub: (() => void)[] = [];
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragMode: 'none' | 'pan' | 'ghost' | 'pinch' = 'none';
  private pinchDist = 0;
  private ghostGrab = { dx: 0, dy: 0 };
  private canvasCleanup: (() => void) | null = null;

  constructor(engine: GameEngine) {
    this.engine = engine;
    audio.enabled = engine.state.settings.sound;
    if (engine.state.phase === 'report') this.lastDayRecord = engine.state.history[engine.state.history.length - 1] ?? null;
  }

  // ------------------------------------------------------------ abonnement React

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  bump(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------------ boucle

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.unsub.push(this.engine.on((e) => this.onEngineEvent(e)));
    this.unsub.push(this.engine.onChange(() => this.bump()));
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    this.renderer.fit(this.engine.state.storeLevel);
    this.bindInput(canvas);
    this.lastTime = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - this.lastTime) / 1000);
      this.lastTime = t;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private baseInsets = { top: 70, bottom: 130 };
  private coachHeight = 0;

  setInsets(top: number, bottom: number): void {
    this.baseInsets = { top, bottom };
    this.applyInsets();
  }

  /** Hauteur de la carte tutoriel/objectifs : la caméra lui réserve de la place. */
  setCoachHeight(h: number): void {
    if (Math.abs(h - this.coachHeight) < 2) return;
    this.coachHeight = h;
    this.applyInsets();
  }

  private applyInsets(): void {
    if (!this.renderer) return;
    // Sur petit écran, la carte tutoriel/objectifs est au-dessus du magasin : on lui réserve sa hauteur.
    const narrow = this.renderer.width < 700;
    const coach = narrow && this.coachHeight ? this.coachHeight + 8 : 0;
    this.renderer.insets = { top: this.baseInsets.top + coach, bottom: this.baseInsets.bottom };
    if (!this.renderer.userCamera) this.renderer.fit(this.engine.state.storeLevel);
  }

  resize(): void {
    if (!this.renderer) return;
    this.renderer.resize();
    this.renderer.fit(this.engine.state.storeLevel);
  }

  recenter(): void {
    if (!this.renderer) return;
    this.renderer.userCamera = false;
    this.renderer.fit(this.engine.state.storeLevel);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvasCleanup?.();
    for (const u of this.unsub) u();
    this.unsub = [];
    this.save();
  }

  private frame(dt: number): void {
    const e = this.engine;
    const s = e.state;
    if (this.speed > 0 && (s.phase === 'running' || s.phase === 'closing') && !this.isBlocked()) {
      // À la fermeture on accélère pour ne pas attendre les derniers clients.
      const mult = s.phase === 'closing' ? Math.max(4, this.speed) : this.speed;
      e.tick(dt * BALANCE.gameMinutesPerSecond * mult);
    }
    e.tickAvatar(dt);
    if (this.renderer) this.renderer.draw(e, this.build, dt);
    // toasts
    let changed = false;
    for (const t of this.toasts) {
      t.ttl -= dt;
      if (t.ttl <= 0) changed = true;
    }
    if (changed) {
      this.toasts = this.toasts.filter((t) => t.ttl > 0);
      this.bump();
    }
    this.saveTimer += dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      this.save();
    }
  }

  /** La simulation est suspendue quand une décision est attendue. */
  isBlocked(): boolean {
    return this.engine.state.pendingEvents.length > 0 || this.levelUps.length > 0 || this.engine.state.bankrupt;
  }

  save(): boolean {
    if (this.noSave) return false;
    return saveGame(this.engine.serialize());
  }

  // ------------------------------------------------------------ actions UI

  setSpeed(sp: Speed): void {
    audio.unlock();
    this.speed = sp;
    this.bump();
  }

  setTab(tab: Tab): void {
    audio.unlock();
    if (this.build.active && tab !== 'store') this.exitBuild();
    this.tab = tab;
    if (tab === 'stock') this.engine.tutorialSignal('stockOpened');
    this.bump();
  }

  toast(text: string, kind: Toast['kind'] = 'info', ttl = 3): void {
    this.toasts.push({ id: this.toastId++, text, kind, ttl });
    if (this.toasts.length > 3) this.toasts.shift();
    this.bump();
  }

  result(r: { ok: boolean; error?: string }, success?: string): boolean {
    if (!r.ok) {
      audio.play('error');
      this.toast(r.error ?? 'Action impossible', 'bad');
      return false;
    }
    if (success) {
      audio.play('ok');
      this.toast(success, 'good');
    }
    return true;
  }

  startDay(): void {
    audio.unlock();
    if (this.result(this.engine.startDay())) {
      if (this.speed === 0) this.speed = 1;
      audio.play('ok');
      this.bump();
    }
  }

  nextDay(): void {
    const r = this.engine.nextDay();
    if (this.result(r)) {
      this.speed = 0;
      this.reportDismissed = false;
      this.save();
      this.bump();
    }
  }

  pickup(): void {
    const n = this.engine.requestPickup();
    if (n > 0) {
      audio.play('ok');
      this.toast(n > 1 ? `Vous allez chercher ${n} livraisons…` : 'Vous allez chercher la livraison…', 'info', 2);
    }
  }

  openConfirm(c: ConfirmState): void {
    this.confirm = c;
    this.bump();
  }

  closeConfirm(): void {
    this.confirm = null;
    this.bump();
  }

  // ------------------------------------------------------------ mode aménagement

  enterBuild(): void {
    this.tab = 'store';
    this.build = { active: true, ghost: null, selectedUid: null, message: null };
    this.bump();
  }

  exitBuild(): void {
    this.build = { active: false, ghost: null, selectedUid: null, message: null };
    this.bump();
  }

  startPlacing(defId: string): void {
    const s = this.engine.state;
    const def = FURNITURE_MAP[defId];
    const g = geometry(s.storeLevel);
    const spot = findFreeSpot(s.storeLevel, s.furniture, defId) ?? {
      x: Math.max(0, Math.floor(g.w / 2) - 1),
      y: Math.max(0, Math.floor((g.h - 2) / 2) - 1),
      rot: 0 as const,
    };
    this.build.ghost = { defId, x: spot.x, y: spot.y, rot: def.w === def.h ? 0 : spot.rot, movingUid: null, valid: false };
    this.build.selectedUid = null;
    this.validateGhost();
  }

  startMove(uid: number): void {
    const f = this.engine.furnitureByUid(uid);
    if (!f) return;
    this.build.ghost = { defId: f.defId, x: f.x, y: f.y, rot: f.rot, movingUid: uid, valid: true };
    this.validateGhost();
  }

  rotateGhost(): void {
    const g = this.build.ghost;
    if (!g) return;
    g.rot = g.rot ? 0 : 1;
    this.validateGhost();
  }

  moveGhostTo(cx: number, cy: number): void {
    const g = this.build.ghost;
    if (!g) return;
    const fp = footprint(g);
    const geo = geometry(this.engine.state.storeLevel);
    g.x = Math.max(0, Math.min(geo.w - fp.w, cx));
    g.y = Math.max(0, Math.min(geo.h - 2 - fp.h, cy));
    this.validateGhost();
  }

  private validateGhost(): void {
    const g = this.build.ghost;
    if (!g) return;
    const s = this.engine.state;
    const err = validatePlacement(s.storeLevel, s.furniture, g, g.movingUid ?? -1);
    g.valid = err === null;
    const def = FURNITURE_MAP[g.defId];
    this.build.message = err ? PLACEMENT_MESSAGES[err] : g.movingUid ? 'Emplacement valide' : `Coût : ${euros(def.cost)}`;
    this.bump();
  }

  confirmGhost(): void {
    const g = this.build.ghost;
    if (!g) return;
    if (g.movingUid) {
      if (this.result(this.engine.moveFurniture(g.movingUid, g.x, g.y, g.rot))) {
        audio.play('build');
        this.build.ghost = null;
        this.build.selectedUid = null;
      }
    } else {
      const r = this.engine.buyFurniture(g.defId, g.x, g.y, g.rot);
      if (this.result(r)) {
        audio.play('build');
        this.build.ghost = null;
        this.build.selectedUid = null;
      }
    }
    this.bump();
  }

  cancelGhost(): void {
    this.build.ghost = null;
    this.build.message = null;
    this.bump();
  }

  sellFurniture(uid: number): void {
    const f = this.engine.furnitureByUid(uid);
    if (!f) return;
    const def = FURNITURE_MAP[f.defId];
    this.openConfirm({
      title: `Revendre « ${def.name} » ?`,
      text: `Vous récupérez ${euros(Math.round(def.cost * BALANCE.resellRatio))}. Les produits exposés retournent en réserve.`,
      confirmLabel: 'Revendre',
      danger: true,
      onConfirm: () => {
        if (this.result(this.engine.sellFurniture(uid), 'Meuble revendu')) {
          this.build.selectedUid = null;
          this.shelfSheet = null;
        }
      },
    });
  }

  // ------------------------------------------------------------ entrées tactiles

  private bindInput(canvas: HTMLCanvasElement): void {
    const pos = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const down = (ev: PointerEvent) => {
      audio.unlock();
      canvas.setPointerCapture?.(ev.pointerId);
      const p = pos(ev);
      this.pointers.set(ev.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.dragMode = 'pinch';
      } else if (this.pointers.size === 1) {
        this.dragMode = 'none';
        const gh = this.build.ghost;
        if (this.build.active && gh && this.renderer) {
          const w = this.renderer.screenToWorld(p.x, p.y);
          const fp = footprint(gh);
          if (w.x >= gh.x - 0.5 && w.x <= gh.x + fp.w + 0.5 && w.y >= gh.y - 1 && w.y <= gh.y + fp.h + 0.5) {
            this.dragMode = 'ghost';
            this.ghostGrab = { dx: w.x - gh.x, dy: w.y - gh.y };
          }
        }
      }
    };
    const move = (ev: PointerEvent) => {
      const pt = this.pointers.get(ev.pointerId);
      if (!pt || !this.renderer) return;
      const p = pos(ev);
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      pt.x = p.x;
      pt.y = p.y;
      const level = this.engine.state.storeLevel;
      if (this.dragMode === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist, level);
        this.pinchDist = d;
        return;
      }
      const moved = Math.hypot(p.x - pt.sx, p.y - pt.sy) > 6;
      if (this.dragMode === 'ghost') {
        const w = this.renderer.screenToWorld(p.x, p.y);
        const nx = Math.round(w.x - this.ghostGrab.dx);
        const ny = Math.round(w.y - this.ghostGrab.dy);
        const gh = this.build.ghost!;
        if (nx !== gh.x || ny !== gh.y) this.moveGhostTo(nx, ny);
        return;
      }
      if (moved || this.dragMode === 'pan') {
        this.dragMode = 'pan';
        this.renderer.pan(dx, dy, level);
      }
    };
    const up = (ev: PointerEvent) => {
      const pt = this.pointers.get(ev.pointerId);
      this.pointers.delete(ev.pointerId);
      if (!pt) return;
      if (this.dragMode === 'none' && this.pointers.size === 0) this.tap(pt.x, pt.y);
      if (this.pointers.size === 0) this.dragMode = 'none';
    };
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault();
      if (!this.renderer) return;
      const r = canvas.getBoundingClientRect();
      this.renderer.zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12, this.engine.state.storeLevel);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    this.canvasCleanup = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }

  private tap(px: number, py: number): void {
    if (!this.renderer) return;
    const e = this.engine;
    const hit = this.renderer.hitTest(e, px, py, this.build.active);
    if (this.build.active) {
      if (this.build.ghost) {
        const w = this.renderer.screenToWorld(px, py);
        const fp = footprint(this.build.ghost);
        this.moveGhostTo(Math.floor(w.x - fp.w / 2 + 0.5), Math.floor(w.y - fp.h / 2 + 0.5));
        return;
      }
      this.build.selectedUid = hit?.type === 'furniture' ? hit.uid : null;
      this.bump();
      return;
    }
    if (!hit) return;
    switch (hit.type) {
      case 'truck':
        this.pickup();
        break;
      case 'desk':
        this.setTab('computer');
        break;
      case 'furniture': {
        const f = e.furnitureByUid(hit.uid);
        if (!f) break;
        const def = FURNITURE_MAP[f.defId];
        if (def.kind === 'shelf') {
          this.shelfSheet = hit.uid;
          this.bump();
        } else {
          this.toast(`${def.icon} ${def.name} — ${def.description}`, 'info', 3);
        }
        break;
      }
      case 'customer': {
        const c = e.customers.find((x) => x.id === hit.id);
        if (c) {
          const seg = SEGMENT_MAP[c.segment];
          const mood = c.satisfaction > 70 ? '😊' : c.satisfaction > 50 ? '🙂' : '😕';
          const items = c.items.reduce((a, it) => a + it.qty, 0);
          this.toast(`${mood} ${seg.name} — ${items} article${items > 1 ? 's' : ''} dans le panier (${euros(c.spent)})`, 'info', 3);
        }
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------ évènements moteur

  private onEngineEvent(ev: EngineEvent): void {
    this.renderer?.handleEvent(ev, this.engine);
    switch (ev.type) {
      case 'sale':
        audio.play('buy');
        break;
      case 'pay':
        audio.play('coin');
        break;
      case 'door':
        audio.play('door');
        break;
      case 'storeOpen':
        audio.play('door');
        this.toast('🏪 Le magasin est ouvert !', 'good', 2.5);
        break;
      case 'storeClose':
        this.toast('🌙 Fermeture : les derniers clients passent en caisse.', 'info', 2.5);
        break;
      case 'truckArrived':
        audio.play('truck');
        this.toast('🚚 Une livraison est arrivée ! Touchez le camion.', 'info', 3.5);
        break;
      case 'deliveryReceived':
        audio.play('ok');
        if (ev.reserved > 0) this.toast(`📦 ${ev.shelved} en rayon, ${ev.reserved} en réserve (pas de place en rayon).`, 'info', 4);
        else this.toast(`📦 ${ev.shelved} articles rangés en rayon.`, 'good', 2.5);
        break;
      case 'levelUp':
        audio.play('unlock');
        this.levelUps.push({ level: ev.level, unlocks: ev.unlocks });
        break;
      case 'unlock':
        this.toast(ev.text, 'good', 3.5);
        break;
      case 'objective':
        audio.play('unlock');
        this.toast(`🎯 Objectif réussi : ${ev.objective.text} (+${euros(ev.objective.rewardCash)})`, 'good', 4);
        break;
      case 'milestone': {
        const m = MILESTONE_MAP[ev.id];
        audio.play('unlock');
        this.toast(`${m.icon} Jalon : ${m.name} (+${euros(m.rewardCash)})`, 'good', 4);
        break;
      }
      case 'dayEnd':
        this.lastDayRecord = ev.record;
        this.reportDismissed = false;
        this.speed = 0;
        this.save();
        break;
      case 'monthReport':
        this.monthReports.push(ev.report);
        break;
      case 'expansion':
        audio.play('unlock');
        this.expansionShown = ev.level;
        this.renderer?.fit(ev.level);
        break;
      case 'gameEvent':
        audio.play('ok');
        break;
      case 'bankrupt':
        audio.play('error');
        break;
      case 'toast':
        this.toast(ev.text, ev.kind);
        break;
      default:
        break;
    }
  }
}
