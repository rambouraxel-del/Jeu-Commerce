// Rendu Canvas 2D du magasin (vue du dessus avec légère perspective).
// Le rendu ne modifie jamais l'état de la simulation : il se contente de le lire.

import { FURNITURE_MAP } from '../data/furniture';
import { PRODUCT_MAP } from '../data/products';
import { FLOOR_STYLES, SIGN_STYLES, WALL_STYLES } from '../data/store';
import { SUPPLIER_MAP } from '../data/suppliers';
import { BALANCE } from '../game/constants';
import type { GameEngine } from '../game/engine';
import { productDiscount } from '../game/marketing/marketing';
import { footprint, geometry, isFixedZone, placementMap } from '../game/store/layout';
import { slotCapacity } from '../game/store/stock';
import type { EngineEvent, PlacedFurniture } from '../game/types';
import { compactEuros } from '../utils/format';
import { customerItems, drawPerson, drawShadow, roundRect } from './sprites';

export interface GhostView {
  defId: string;
  x: number;
  y: number;
  rot: 0 | 1;
  movingUid: number | null;
  valid: boolean;
}

export interface BuildView {
  active: boolean;
  ghost: GhostView | null;
  selectedUid: number | null;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
}
interface Bubble {
  customerId: number;
  text: string;
  mood: 'good' | 'bad' | 'neutral';
  life: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export type HitResult =
  | { type: 'furniture'; uid: number }
  | { type: 'truck' }
  | { type: 'desk' }
  | { type: 'customer'; id: number }
  | { type: 'cell'; x: number; y: number }
  | null;

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  width = 0;
  height = 0;
  scale = 40;
  ox = 0;
  oy = 0;
  time = 0;
  private floats: FloatText[] = [];
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private shelfFlash = new Map<number, number>();
  private truckArrive = new Map<number, number>();
  private fittedLevel = 0;
  private flashScreen = 0;
  insets = { top: 0, bottom: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  /** Bornes du monde affiché (magasin + abords). */
  worldBounds(level: number): { x0: number; y0: number; x1: number; y1: number } {
    const g = geometry(level);
    return { x0: -0.5, y0: -1.5, x1: g.w + 3.1, y1: g.h + 1.6 };
  }

  fit(level: number): void {
    const b = this.worldBounds(level);
    const availH = this.height - this.insets.top - this.insets.bottom;
    const sx = this.width / (b.x1 - b.x0);
    const sy = availH / (b.y1 - b.y0);
    this.scale = Math.max(8, Math.min(sx, sy, 90));
    this.ox = (this.width - (b.x1 - b.x0) * this.scale) / 2 - b.x0 * this.scale;
    this.oy = this.insets.top + (availH - (b.y1 - b.y0) * this.scale) / 2 - b.y0 * this.scale;
    this.fittedLevel = level;
  }

  minScale(level: number): number {
    const b = this.worldBounds(level);
    return Math.min(this.width / (b.x1 - b.x0), (this.height - this.insets.top - this.insets.bottom) / (b.y1 - b.y0)) * 0.7;
  }

  zoomAt(px: number, py: number, factor: number, level: number): void {
    const ns = Math.max(this.minScale(level), Math.min(110, this.scale * factor));
    const wx = (px - this.ox) / this.scale;
    const wy = (py - this.oy) / this.scale;
    this.scale = ns;
    this.ox = px - wx * ns;
    this.oy = py - wy * ns;
    this.clampCamera(level);
  }

  pan(dx: number, dy: number, level: number): void {
    this.ox += dx;
    this.oy += dy;
    this.clampCamera(level);
  }

  private clampCamera(level: number): void {
    const b = this.worldBounds(level);
    const minX = this.width * 0.5 - b.x1 * this.scale;
    const maxX = this.width * 0.5 - b.x0 * this.scale;
    const minY = this.height * 0.5 - b.y1 * this.scale;
    const maxY = this.height * 0.5 - b.y0 * this.scale;
    this.ox = Math.max(minX, Math.min(maxX, this.ox));
    this.oy = Math.max(minY, Math.min(maxY, this.oy));
  }

  screenToWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: x * this.scale + this.ox, y: y * this.scale + this.oy };
  }

  // ------------------------------------------------------------ évènements visuels

  handleEvent(e: EngineEvent, engine: GameEngine): void {
    switch (e.type) {
      case 'sale':
        this.spark(e.x, e.y - 0.4, PRODUCT_MAP[e.productId]?.color ?? '#fff', 3);
        break;
      case 'pay':
        this.floats.push({ x: e.x, y: e.y - 1, text: '+' + compactEuros(e.amount), color: '#1f9d55', life: 1.6, max: 1.6 });
        this.spark(e.x, e.y - 0.8, '#ffd166', 6);
        break;
      case 'reaction':
        if (this.bubbles.length < 4) this.bubbles.push({ customerId: e.customerId, text: e.text, mood: e.mood, life: 2.6 });
        break;
      case 'shelfFilled':
        this.shelfFlash.set(e.uid, 0.8);
        {
          const f = engine.furnitureByUid(e.uid);
          if (f) {
            const fp = footprint(f);
            this.spark(f.x + fp.w / 2, f.y + fp.h / 2 - 0.4, '#8ce99a', 8);
          }
        }
        break;
      case 'truckArrived':
        this.truckArrive.set(e.orderId, this.time);
        break;
      case 'deliveryReceived': {
        const g = geometry(engine.state.storeLevel);
        this.floats.push({ x: g.w - 0.5, y: g.h - 2.3, text: `📦 +${e.shelved + e.reserved}`, color: '#7a4b12', life: 1.8, max: 1.8 });
        for (let i = 0; i < 14; i++) this.spark(g.w - 0.5, g.h - 2, ['#c69c6d', '#ffd166', '#8ecae6'][i % 3], 1);
        break;
      }
      case 'expansion':
      case 'levelUp':
        this.confetti(engine);
        if (e.type === 'expansion') {
          this.flashScreen = 1;
          this.fittedLevel = 0;
        }
        break;
      default:
        break;
    }
  }

  private spark(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 250) return;
      const a = Math.random() * Math.PI * 2;
      const v = 0.6 + Math.random() * 1.4;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2, life: 0.7, max: 0.7, color, size: 0.06 + Math.random() * 0.05 });
    }
  }

  private confetti(engine: GameEngine): void {
    const g = geometry(engine.state.storeLevel);
    const colors = ['#e4572e', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec'];
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: Math.random() * g.w,
        y: -1 - Math.random() * 2,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1 + Math.random() * 2,
        life: 2.2,
        max: 2.2,
        color: colors[i % colors.length],
        size: 0.08 + Math.random() * 0.06,
      });
    }
  }

  // ------------------------------------------------------------ interactions

  hitTest(engine: GameEngine, px: number, py: number, build: boolean): HitResult {
    const { x, y } = this.screenToWorld(px, py);
    const s = engine.state;
    const g = geometry(s.storeLevel);
    // camion
    if (!build && s.orders.some((o) => o.status === 'arrived')) {
      const t = g.truckSpot;
      if (x > t.x - 1.1 && x < t.x + 1.1 && y > t.y - 1.4 && y < t.y + 2.2) return { type: 'truck' };
    }
    // bureau
    if (Math.floor(x) === g.desk.x && y > g.desk.y - 0.8 && y < g.desk.y + 1) return { type: 'desk' };
    // meubles (en tenant compte de la hauteur dessinée)
    for (let i = s.furniture.length - 1; i >= 0; i--) {
      const f = s.furniture[i];
      const fp = footprint(f);
      if (x >= f.x && x < f.x + fp.w && y >= f.y - 0.5 && y < f.y + fp.h) return { type: 'furniture', uid: f.uid };
    }
    if (!build) {
      for (const c of engine.customers) {
        if (Math.abs(x - c.x) < 0.3 && y < c.y + 0.1 && y > c.y - 1) return { type: 'customer', id: c.id };
      }
    }
    if (x >= 0 && y >= 0 && x < g.w && y < g.h) return { type: 'cell', x: Math.floor(x), y: Math.floor(y) };
    return null;
  }

  // ------------------------------------------------------------ dessin

  draw(engine: GameEngine, build: BuildView, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    const s = engine.state;
    if (this.fittedLevel !== s.storeLevel) this.fit(s.storeLevel);
    const g = geometry(s.storeLevel);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#8fc97a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, this.dpr * this.ox, this.dpr * this.oy);

    this.drawSurroundings(engine);
    this.drawFloor(engine);
    this.drawBackWall(engine);
    if (build.active) this.drawBuildGrid(engine, build);

    // objets triés en profondeur
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    for (const f of s.furniture) {
      if (build.ghost && build.ghost.movingUid === f.uid) continue;
      const fp = footprint(f);
      list.push({ y: f.y + fp.h, draw: () => this.drawFurniture(engine, f, build.selectedUid === f.uid) });
    }
    g.checkouts.forEach((c, i) => list.push({ y: c.y + 0.95, draw: () => this.drawCheckout(c.x, c.y, i) }));
    list.push({ y: g.desk.y + 0.95, draw: () => this.drawDesk(engine) });
    for (const c of engine.customers) {
      list.push({
        y: c.y,
        draw: () =>
          drawPerson(ctx, c.x, c.y, {
            skin: c.skin,
            variant: c.variant,
            facing: c.facing,
            walk: c.walkPhase,
            moving: c.path.length > 0,
            items: customerItems(c),
          }),
      });
    }
    const a = engine.avatar;
    list.push({
      y: a.y,
      draw: () =>
        drawPerson(ctx, a.x, a.y, {
          skin: 3,
          variant: 0,
          facing: a.facing,
          walk: a.walkPhase,
          moving: a.path.length > 0,
          items: 0,
          isPlayer: true,
          playerColor: s.customization.mainColor,
          carrying: a.task.type === 'carrying' || a.task.type === 'opening',
        }),
    });
    list.sort((p, q) => p.y - q.y);
    for (const d of list) d.draw();

    this.drawFrontWall(engine);
    this.drawTruck(engine);
    if (build.ghost) this.drawGhost(engine, build.ghost);
    this.drawEffects(engine, dt);
    this.drawNight(engine);

    if (this.flashScreen > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${this.flashScreen * 0.8})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.flashScreen = Math.max(0, this.flashScreen - dt * 1.2);
    }
  }

  private drawSurroundings(engine: GameEngine): void {
    const ctx = this.ctx;
    const s = engine.state;
    const g = geometry(s.storeLevel);
    const b = this.worldBounds(s.storeLevel);
    const pad = 30;
    // herbe (fond) déjà peinte ; trottoir et rue en bas
    ctx.fillStyle = '#c9c5bd';
    ctx.fillRect(b.x0 - pad, g.h + 0.25, b.x1 - b.x0 + pad * 2, 1.7);
    ctx.fillStyle = '#b8b3aa';
    for (let x = Math.floor(b.x0 - pad); x < b.x1 + pad; x += 1) ctx.fillRect(x, g.h + 0.25, 0.03, 1.7);
    ctx.fillStyle = '#5b5f66';
    ctx.fillRect(b.x0 - pad, g.h + 1.95, b.x1 - b.x0 + pad * 2, 2.5 + pad);
    ctx.fillStyle = '#f1f1f1';
    for (let x = Math.floor(b.x0 - pad); x < b.x1 + pad; x += 2) ctx.fillRect(x, g.h + 3.05, 1, 0.08);

    // zone de livraison (à droite)
    ctx.fillStyle = '#6c7078';
    ctx.fillRect(g.w + 0.25, g.h - 5.2, 2.95, 5.45);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 0.06;
    ctx.setLineDash([0.25, 0.18]);
    ctx.strokeRect(g.w + 0.45, g.h - 4.9, 2.55, 4.9);
    ctx.setLineDash([]);
    this.worldText('LIVRAISONS', g.w + 1.72, g.h - 5.0, 0.24, '#ffd166', 'center', true);

    // arbres décoratifs à gauche
    const trees = Math.max(2, Math.floor(g.h / 3));
    for (let i = 0; i < trees; i++) {
      const ty = 0.5 + i * (g.h / trees);
      this.drawTree(-0.7, ty + 0.6, 0.45 + (i % 2) * 0.1);
    }
    // parking pour les grands magasins
    if (s.storeLevel >= 4) {
      const cars = ['#e63946', '#457b9d', '#f1faee', '#2a9d8f', '#ffb703'];
      for (let i = 0; i < Math.min(8, s.storeLevel * 2 - 4); i++) {
        const cx = 0.3 + i * 1.6;
        if (cx > g.w + 3) break;
        ctx.fillStyle = cars[i % cars.length];
        roundRect(ctx, cx, g.h + 2.2, 1.1, 0.6, 0.15);
        ctx.fill();
        ctx.fillStyle = 'rgba(160,210,255,0.8)';
        ctx.fillRect(cx + 0.3, g.h + 2.28, 0.45, 0.44);
      }
    }
  }

  private drawTree(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    drawShadow(ctx, x, y, r * 0.8, r * 0.3);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x - 0.06, y - 0.4, 0.12, 0.4);
    ctx.fillStyle = '#3f8f4f';
    ctx.beginPath();
    ctx.arc(x, y - 0.6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#56a862';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - 0.7, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFloor(engine: GameEngine): void {
    const ctx = this.ctx;
    const s = engine.state;
    const g = geometry(s.storeLevel);
    const floor = FLOOR_STYLES[s.customization.floorStyle] ?? FLOOR_STYLES[0];
    // murs latéraux (épaisseur)
    const wall = WALL_STYLES[s.customization.wallStyle] ?? WALL_STYLES[0];
    ctx.fillStyle = wall.colors[1];
    ctx.fillRect(-0.25, -0.2, 0.25, g.h + 0.45);
    ctx.fillRect(g.w, -0.2, 0.25, g.h + 0.45);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const fixed = isFixedZone(s.storeLevel, y);
        ctx.fillStyle = (x + y) % 2 === 0 ? floor.colors[0] : floor.colors[1];
        if (fixed) ctx.fillStyle = (x + y) % 2 === 0 ? '#e9e2d4' : '#ddd4c2';
        ctx.fillRect(x, y, 1.01, 1.01);
      }
    }
    if (s.customization.floorStyle === 1) {
      ctx.strokeStyle = 'rgba(120,80,40,0.18)';
      ctx.lineWidth = 0.02;
      for (let y = 0; y < g.h - 2; y += 0.33) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(g.w, y);
        ctx.stroke();
      }
    }
    if (s.customization.floorStyle === 4) {
      ctx.strokeStyle = 'rgba(150,140,130,0.25)';
      ctx.lineWidth = 0.02;
      for (let i = 0; i < g.w; i += 3) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.quadraticCurveTo(i + 1.2, (g.h - 2) / 2, i + 0.4, g.h - 2);
        ctx.stroke();
      }
    }
    // tapis d'entrée
    ctx.fillStyle = '#6b4f3a';
    ctx.fillRect(g.doorX - 0.3, g.h - 1.9, 1.6, 0.8);
    ctx.fillStyle = s.customization.mainColor;
    ctx.fillRect(g.doorX - 0.2, g.h - 1.8, 1.4, 0.6);
    // ligne de la zone d'accueil
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0, g.h - 2);
    ctx.lineTo(g.w, g.h - 2);
    ctx.stroke();
  }

  private drawBackWall(engine: GameEngine): void {
    const ctx = this.ctx;
    const s = engine.state;
    const g = geometry(s.storeLevel);
    const wall = WALL_STYLES[s.customization.wallStyle] ?? WALL_STYLES[0];
    ctx.fillStyle = wall.colors[0];
    ctx.fillRect(-0.25, -1.2, g.w + 0.5, 1.2);
    if (s.customization.wallStyle === 3) {
      ctx.strokeStyle = 'rgba(90,40,30,0.35)';
      ctx.lineWidth = 0.02;
      for (let y = -1.2; y < 0; y += 0.2) {
        ctx.beginPath();
        ctx.moveTo(-0.25, y);
        ctx.lineTo(g.w + 0.25, y);
        ctx.stroke();
        for (let x = -0.25 + ((Math.round(y * 5) % 2) * 0.2); x < g.w; x += 0.4) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 0.2);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = wall.colors[1];
    ctx.fillRect(-0.25, -0.12, g.w + 0.5, 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, g.w, 0.18);
    // éclairage
    const lit = s.upgrades.includes('lighting');
    for (let x = 1; x < g.w; x += 3) {
      ctx.fillStyle = lit ? '#fff7d6' : '#ddd';
      ctx.fillRect(x, -1.05, 1, 0.08);
      if (lit) {
        ctx.fillStyle = 'rgba(255,245,200,0.18)';
        ctx.beginPath();
        ctx.moveTo(x, -0.97);
        ctx.lineTo(x + 1, -0.97);
        ctx.lineTo(x + 1.6, 0.4);
        ctx.lineTo(x - 0.6, 0.4);
        ctx.fill();
      }
    }
    // horloge murale / enseigne intérieure
    this.worldText(s.customization.storeName.toUpperCase(), g.w / 2, -0.55, 0.36, '#ffffff', 'center', true, s.customization.mainColor);
  }

  private drawFrontWall(engine: GameEngine): void {
    const ctx = this.ctx;
    const s = engine.state;
    const g = geometry(s.storeLevel);
    const wall = WALL_STYLES[s.customization.wallStyle] ?? WALL_STYLES[0];
    // mur de façade (bas) avec vitrines
    ctx.fillStyle = wall.colors[1];
    ctx.fillRect(-0.25, g.h, g.w + 0.5, 0.28);
    ctx.fillStyle = 'rgba(170,215,240,0.85)';
    for (let x = 0.2; x < g.w - 0.2; x += 1) {
      if (Math.abs(x + 0.3 - (g.doorX + 0.5)) < 0.9) continue;
      ctx.fillRect(x, g.h + 0.06, 0.6, 0.14);
    }
    // porte
    const open = engine.isOpen();
    ctx.fillStyle = open ? 'rgba(200,240,255,0.5)' : '#8d99ae';
    ctx.fillRect(g.doorX + 0.05, g.h - 0.05, 0.9, 0.36);
    // store / auvent
    const col = s.customization.mainColor;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : col;
      ctx.fillRect(g.doorX - 1 + i * 0.5, g.h + 0.28, 0.5, 0.22);
    }
    // enseigne extérieure
    const sign = SIGN_STYLES[s.customization.signStyle] ?? SIGN_STYLES[0];
    const sw = Math.min(g.w - 0.5, 1 + s.customization.storeName.length * 0.2);
    const sx = g.doorX + 0.5 - sw / 2;
    ctx.fillStyle = sign.colors[0];
    roundRect(ctx, sx, g.h + 0.52, sw, 0.42, 0.08);
    ctx.fill();
    if (s.upgrades.includes('sign1') || s.customization.signStyle === 2) {
      ctx.strokeStyle = sign.colors[1];
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }
    this.worldText(s.customization.storeName, g.doorX + 0.5, g.h + 0.74, 0.26, sign.colors[1], 'center', true);
    if (s.upgrades.includes('sign2')) {
      const glow = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.fillStyle = `rgba(255,220,120,${0.15 + glow * 0.15})`;
      roundRect(ctx, sx - 0.15, g.h + 0.45, sw + 0.3, 0.56, 0.12);
      ctx.fill();
    }
    // panneau ouvert / fermé
    this.worldText(open ? 'OUVERT' : 'FERMÉ', g.doorX + 0.5, g.h + 1.25, 0.2, '#fff', 'center', true, open ? '#2b9348' : '#9d0208');
    // promo magasin
    if (s.promotions.some((p) => p.scope === 'store')) {
      const p = s.promotions.find((x) => x.scope === 'store')!;
      this.worldText(`PROMO −${Math.round(p.discount * 100)} %`, g.doorX - 2.2, g.h + 1.25, 0.2, '#fff', 'center', true, '#e63946');
    }
    // porte de service
    ctx.fillStyle = '#6d597a';
    ctx.fillRect(g.w, g.h - 2, 0.25, 1);
  }

  private drawBuildGrid(engine: GameEngine, build: BuildView): void {
    const ctx = this.ctx;
    const s = engine.state;
    const g = geometry(s.storeLevel);
    const map = placementMap(s.storeLevel, s.furniture, build.ghost?.movingUid ?? -1);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const free = map[y * g.w + x] === 1;
        ctx.fillStyle = free ? 'rgba(64,192,87,0.16)' : 'rgba(224,49,49,0.16)';
        ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.02;
    for (let x = 0; x <= g.w; x++) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, g.h);
      ctx.stroke();
    }
    for (let y = 0; y <= g.h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(g.w, y);
      ctx.stroke();
    }
  }

  private drawGhost(engine: GameEngine, gh: GhostView): void {
    const ctx = this.ctx;
    const def = FURNITURE_MAP[gh.defId];
    const fake: PlacedFurniture = {
      uid: -1,
      defId: gh.defId,
      x: gh.x,
      y: gh.y,
      rot: gh.rot,
      slots: gh.movingUid ? engine.furnitureByUid(gh.movingUid)?.slots ?? [] : Array.from({ length: def.slots ?? 0 }, () => ({ productId: null, qty: 0 })),
    };
    const fp = footprint(fake);
    ctx.globalAlpha = 0.75;
    this.drawFurniture(engine, fake, false);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gh.valid ? 'rgba(64,192,87,0.35)' : 'rgba(224,49,49,0.4)';
    ctx.fillRect(gh.x, gh.y, fp.w, fp.h);
    ctx.strokeStyle = gh.valid ? '#2b9348' : '#d00000';
    ctx.lineWidth = 0.07;
    ctx.setLineDash([0.2, 0.12]);
    ctx.strokeRect(gh.x, gh.y, fp.w, fp.h);
    ctx.setLineDash([]);
  }

  private drawFurniture(engine: GameEngine, f: PlacedFurniture, selected: boolean): void {
    const ctx = this.ctx;
    const s = engine.state;
    const def = FURNITURE_MAP[f.defId];
    const fp = footprint(f);
    const x = f.x;
    const y = f.y;
    const flash = this.shelfFlash.get(f.uid) ?? 0;

    if (selected) {
      ctx.fillStyle = 'rgba(255,209,102,0.45)';
      ctx.fillRect(x - 0.08, y - 0.08, fp.w + 0.16, fp.h + 0.16);
    }

    if (def.kind === 'deco') {
      this.drawDeco(f.defId, x, y, fp.w, fp.h);
      return;
    }

    const H = 0.62; // hauteur visuelle
    drawShadow(ctx, x + fp.w / 2, y + fp.h - 0.02, fp.w / 2, 0.12);
    const body = def.color;
    const isFridge = f.defId === 'frigo' || f.defId === 'frigo_xl';
    const isRack = f.defId === 'portant';
    const isVitrine = f.defId === 'vitrine' || f.defId === 'presentoir_lux';
    const isBasket = f.defId === 'panier_pain';

    if (isRack) {
      // portant : barre + vêtements suspendus
      ctx.fillStyle = '#6c757d';
      ctx.fillRect(x + 0.08, y + fp.h - 0.95, 0.05, 0.9);
      ctx.fillRect(x + fp.w - 0.13, y + fp.h - 0.95, 0.05, 0.9);
      ctx.fillRect(x + 0.08, y + fp.h - 0.95, fp.w - 0.16, 0.05);
      this.drawSlotItems(engine, f, x + 0.15, y + fp.h - 0.88, fp.w - 0.3, 0.7, true);
    } else if (isBasket) {
      ctx.fillStyle = '#a47148';
      roundRect(ctx, x + 0.1, y + fp.h - 0.55, fp.w - 0.2, 0.45, 0.1);
      ctx.fill();
      ctx.strokeStyle = '#7f5539';
      ctx.lineWidth = 0.03;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 0.1, y + fp.h - 0.5 + i * 0.1);
        ctx.lineTo(x + fp.w - 0.1, y + fp.h - 0.5 + i * 0.1);
        ctx.stroke();
      }
      this.drawSlotItems(engine, f, x + 0.15, y + fp.h - 0.78, fp.w - 0.3, 0.3, false);
    } else {
      // meuble : dessus + façade
      const top = y + fp.h - H - 0.3;
      ctx.fillStyle = shade(body, 0.25);
      roundRect(ctx, x + 0.05, top, fp.w - 0.1, 0.3, 0.05);
      ctx.fill();
      ctx.fillStyle = body;
      roundRect(ctx, x + 0.05, top + 0.25, fp.w - 0.1, H + 0.02, 0.04);
      ctx.fill();
      const inner = isFridge ? '#e7f6ff' : isVitrine ? '#1f2937' : shade(body, -0.35);
      ctx.fillStyle = inner;
      ctx.fillRect(x + 0.12, top + 0.32, fp.w - 0.24, H - 0.12);
      if (fp.h > 1) {
        // meuble pivoté : on voit le dessus allongé
        ctx.fillStyle = shade(body, 0.15);
        ctx.fillRect(x + 0.05, y + 0.05, fp.w - 0.1, fp.h - H - 0.3);
      }
      this.drawSlotItems(engine, f, x + 0.14, top + 0.34, fp.w - 0.28, H - 0.16, false);
      if (isFridge || isVitrine) {
        ctx.fillStyle = isVitrine ? 'rgba(180,220,255,0.18)' : 'rgba(255,255,255,0.28)';
        ctx.fillRect(x + 0.12, top + 0.32, fp.w - 0.24, H - 0.12);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 0.02;
        ctx.beginPath();
        ctx.moveTo(x + 0.2, top + 0.36);
        ctx.lineTo(x + 0.35, top + 0.36 + H - 0.2);
        ctx.stroke();
      }
      if (f.defId === 'tete_gondole') {
        ctx.fillStyle = '#e63946';
        ctx.fillRect(x + 0.05, top - 0.25, fp.w - 0.1, 0.22);
        this.worldText('PROMO', x + fp.w / 2, top - 0.14, 0.15, '#fff', 'center', true);
      }
      if (f.defId === 'presentoir_lux') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 0.04;
        ctx.strokeRect(x + 0.08, top + 0.28, fp.w - 0.16, H - 0.04);
      }
    }

    // étiquettes promo
    const promo = f.slots.some((sl) => sl.productId && productDiscount(s, sl.productId) > 0);
    if (promo) {
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(x + fp.w - 0.15, y + fp.h - H - 0.3, 0.14, 0, Math.PI * 2);
      ctx.fill();
      this.worldText('%', x + fp.w - 0.15, y + fp.h - H - 0.3, 0.16, '#fff', 'center', true);
    }
    // alerte rupture
    const empty = f.slots.some((sl) => sl.productId && sl.qty === 0);
    if (empty) {
      const bounce = Math.sin(this.time * 5) * 0.05;
      ctx.fillStyle = '#ff006e';
      ctx.beginPath();
      ctx.arc(x + 0.15, y + fp.h - H - 0.35 + bounce, 0.13, 0, Math.PI * 2);
      ctx.fill();
      this.worldText('!', x + 0.15, y + fp.h - H - 0.35 + bounce, 0.18, '#fff', 'center', true);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(140,233,154,${flash * 0.5})`;
      ctx.fillRect(x, y - 0.4, fp.w, fp.h + 0.4);
    }
  }

  /** Dessine les produits d'un rayon en fonction du remplissage réel des emplacements. */
  private drawSlotItems(engine: GameEngine, f: PlacedFurniture, x: number, y: number, w: number, h: number, hanging: boolean): void {
    const ctx = this.ctx;
    const n = f.slots.length;
    if (!n) return;
    const rows = hanging ? 1 : h > 0.35 ? 2 : 1;
    const perRow = Math.max(1, Math.ceil(n / rows));
    const sw = w / perRow;
    const rh = h / rows;
    f.slots.forEach((sl, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const sx = x + c * sw;
      const sy = y + r * rh;
      if (!sl.productId) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.015;
        ctx.strokeRect(sx + 0.03, sy + 0.03, sw - 0.06, rh - 0.06);
        return;
      }
      const prod = PRODUCT_MAP[sl.productId];
      const cap = slotCapacity(engine.state, f, sl.productId);
      const fill = cap > 0 ? sl.qty / cap : 0;
      const maxItems = hanging ? 5 : 6;
      const count = sl.qty > 0 ? Math.max(1, Math.round(fill * maxItems)) : 0;
      const iw = (sw - 0.06) / maxItems;
      for (let k = 0; k < count; k++) {
        const ix = sx + 0.03 + k * iw;
        if (hanging) {
          ctx.fillStyle = prod.color;
          ctx.fillRect(ix + iw * 0.1, sy + 0.08, iw * 0.8, rh * 0.75);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(ix + iw * 0.1, sy + 0.08, iw * 0.8, 0.04);
        } else {
          const ih = rh * (prod.shape === 'bottle' ? 0.8 : prod.shape === 'can' ? 0.55 : 0.68);
          ctx.fillStyle = prod.color;
          ctx.fillRect(ix + iw * 0.08, sy + rh - ih - 0.02, iw * 0.84, ih);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(ix + iw * 0.08, sy + rh - 0.05, iw * 0.84, 0.03);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(ix + iw * 0.12, sy + rh - ih, iw * 0.2, ih * 0.6);
        }
      }
    });
  }

  private drawDeco(id: string, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const cx = x + w / 2;
    const by = y + h - 0.1;
    switch (id) {
      case 'plante':
        drawShadow(ctx, cx, by, 0.25, 0.08);
        ctx.fillStyle = '#b5651d';
        roundRect(ctx, cx - 0.16, by - 0.3, 0.32, 0.3, 0.05);
        ctx.fill();
        ctx.fillStyle = '#2d6a4f';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(i * 1.3) * 0.12, by - 0.5 + Math.sin(i * 2) * 0.08, 0.13, 0.22, i * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'palmier':
        drawShadow(ctx, cx, by, 0.35, 0.1);
        ctx.fillStyle = '#8d6e63';
        roundRect(ctx, cx - 0.2, by - 0.3, 0.4, 0.3, 0.05);
        ctx.fill();
        ctx.fillStyle = '#7f5539';
        ctx.fillRect(cx - 0.05, by - 1.1, 0.1, 0.85);
        ctx.fillStyle = '#40916c';
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(i) * 0.3, by - 1.15 + Math.sin(i * 1.7) * 0.1, 0.35, 0.1, i, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'affiche':
        ctx.fillStyle = '#555';
        ctx.fillRect(cx - 0.03, by - 0.5, 0.06, 0.5);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 0.3, by - 1.0, 0.6, 0.55);
        ctx.fillStyle = '#ff8fab';
        ctx.fillRect(cx - 0.25, by - 0.95, 0.5, 0.25);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(cx, by - 0.6, 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'lampadaire': {
        ctx.fillStyle = '#444';
        ctx.fillRect(cx - 0.03, by - 1.0, 0.06, 1.0);
        ctx.fillRect(cx - 0.15, by - 0.05, 0.3, 0.05);
        const glow = ctx.createRadialGradient(cx, by - 1.05, 0.05, cx, by - 1.05, 0.7);
        glow.addColorStop(0, 'rgba(255,230,150,0.55)');
        glow.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - 0.7, by - 1.75, 1.4, 1.4);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(cx, by - 1.05, 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'banc':
        drawShadow(ctx, cx, by, w / 2, 0.1);
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(x + 0.15, by - 0.35, w - 0.3, 0.12);
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(x + 0.1, by - 0.25, w - 0.2, 0.15);
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 0.2, by - 0.1, 0.06, 0.1);
        ctx.fillRect(x + w - 0.26, by - 0.1, 0.06, 0.1);
        break;
      case 'fontaine': {
        drawShadow(ctx, cx, by - 0.2, 0.9, 0.3);
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath();
        ctx.ellipse(cx, by - 0.6, 0.9, 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ea8de';
        ctx.beginPath();
        ctx.ellipse(cx, by - 0.65, 0.75, 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 0.03;
        for (let i = 0; i < 3; i++) {
          const r = ((this.time * 0.5 + i / 3) % 1) * 0.7;
          ctx.globalAlpha = 1 - r / 0.7;
          ctx.beginPath();
          ctx.ellipse(cx, by - 0.65, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ced4da';
        ctx.fillRect(cx - 0.08, by - 1.3, 0.16, 0.65);
        ctx.fillStyle = 'rgba(160,210,255,0.8)';
        ctx.beginPath();
        ctx.arc(cx, by - 1.35, 0.15 + Math.sin(this.time * 6) * 0.02, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sculpture':
        drawShadow(ctx, cx, by, 0.3, 0.1);
        ctx.fillStyle = '#6c757d';
        ctx.fillRect(cx - 0.25, by - 0.3, 0.5, 0.3);
        ctx.fillStyle = '#dee2e6';
        ctx.beginPath();
        ctx.moveTo(cx - 0.15, by - 0.3);
        ctx.quadraticCurveTo(cx + 0.35, by - 0.8, cx - 0.05, by - 1.25);
        ctx.quadraticCurveTo(cx - 0.3, by - 0.8, cx + 0.12, by - 0.3);
        ctx.fill();
        break;
      case 'aquarium': {
        drawShadow(ctx, cx, by, w / 2, 0.1);
        ctx.fillStyle = '#343a40';
        ctx.fillRect(x + 0.05, by - 0.35, w - 0.1, 0.35);
        ctx.fillStyle = '#0077b6';
        ctx.fillRect(x + 0.08, by - 1.05, w - 0.16, 0.7);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 0.08, by - 1.05, w - 0.16, 0.1);
        const fish = ['#ffb703', '#fb8500', '#e63946'];
        for (let i = 0; i < 3; i++) {
          const fx = x + 0.3 + ((this.time * (0.3 + i * 0.1) + i * 0.4) % 1) * (w - 0.6);
          const fy = by - 0.9 + i * 0.17;
          ctx.fillStyle = fish[i];
          ctx.beginPath();
          ctx.ellipse(fx, fy, 0.09, 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default:
        ctx.fillStyle = FURNITURE_MAP[id]?.color ?? '#999';
        ctx.fillRect(x + 0.1, y + 0.1, w - 0.2, h - 0.2);
    }
  }

  private drawCheckout(x: number, y: number, index: number): void {
    const ctx = this.ctx;
    drawShadow(ctx, x + 0.5, y + 0.85, 0.5, 0.1);
    ctx.fillStyle = index === 0 ? '#495057' : '#6c757d';
    roundRect(ctx, x + 0.05, y + 0.05, 0.9, 0.8, 0.06);
    ctx.fill();
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(x + 0.05, y + 0.05, 0.9, 0.25);
    ctx.fillStyle = '#212529';
    ctx.fillRect(x + 0.55, y - 0.3, 0.3, 0.35);
    ctx.fillStyle = index === 0 ? '#80ed99' : '#4cc9f0';
    ctx.fillRect(x + 0.58, y - 0.27, 0.24, 0.2);
    if (index > 0) this.worldText('AUTO', x + 0.5, y + 0.55, 0.15, '#fff', 'center', true);
  }

  private drawDesk(engine: GameEngine): void {
    const ctx = this.ctx;
    const g = geometry(engine.state.storeLevel);
    const x = g.desk.x;
    const y = g.desk.y;
    drawShadow(ctx, x + 0.5, y + 0.85, 0.5, 0.1);
    ctx.fillStyle = '#8d6e63';
    roundRect(ctx, x + 0.05, y + 0.1, 0.9, 0.75, 0.06);
    ctx.fill();
    ctx.fillStyle = '#212529';
    ctx.fillRect(x + 0.2, y - 0.35, 0.6, 0.42);
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3);
    ctx.fillStyle = `rgba(76,201,240,${pulse})`;
    ctx.fillRect(x + 0.25, y - 0.31, 0.5, 0.32);
    ctx.fillStyle = '#212529';
    ctx.fillRect(x + 0.45, y + 0.07, 0.1, 0.06);
    this.worldText('💻', x + 0.5, y - 0.62, 0.3, '#000', 'center', false);
  }

  private drawTruck(engine: GameEngine): void {
    const ctx = this.ctx;
    const s = engine.state;
    const arrived = s.orders.filter((o) => o.status === 'arrived');
    if (!arrived.length) return;
    const g = geometry(s.storeLevel);
    const o = arrived[0];
    const sup = SUPPLIER_MAP[o.supplierId];
    const t0 = this.truckArrive.get(o.id);
    const p = t0 === undefined ? 1 : Math.min(1, (this.time - t0) / 1.2);
    const ease = 1 - Math.pow(1 - p, 3);
    const tx = g.truckSpot.x;
    const ty = g.truckSpot.y + (1 - ease) * 6;
    drawShadow(ctx, tx, ty + 1.6, 0.9, 0.2);
    // caisse du camion
    ctx.fillStyle = '#f8f9fa';
    roundRect(ctx, tx - 0.8, ty - 1.2, 1.6, 2.1, 0.1);
    ctx.fill();
    ctx.fillStyle = sup.truckColor;
    ctx.fillRect(tx - 0.8, ty - 0.2, 1.6, 0.35);
    this.worldText(sup.name.split(' ')[0], tx, ty - 0.03, 0.2, '#fff', 'center', true);
    // cabine
    ctx.fillStyle = sup.truckColor;
    roundRect(ctx, tx - 0.75, ty + 0.85, 1.5, 0.75, 0.15);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.9)';
    ctx.fillRect(tx - 0.6, ty + 1.05, 1.2, 0.3);
    // cartons
    const boxes = Math.min(4, o.lines.length);
    for (let i = 0; i < boxes; i++) {
      ctx.fillStyle = '#c69c6d';
      ctx.fillRect(tx - 0.6 + (i % 2) * 0.62, ty - 1.05 + Math.floor(i / 2) * 0.5, 0.55, 0.42);
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 0.02;
      ctx.strokeRect(tx - 0.6 + (i % 2) * 0.62, ty - 1.05 + Math.floor(i / 2) * 0.5, 0.55, 0.42);
    }
    if (p >= 1 && engine.avatar.task.type === 'idle') {
      const b = Math.sin(this.time * 5) * 0.1;
      ctx.fillStyle = '#ff006e';
      ctx.beginPath();
      ctx.arc(tx, ty - 1.6 + b, 0.28, 0, Math.PI * 2);
      ctx.fill();
      this.worldText(arrived.length > 1 ? `×${arrived.length}` : '!', tx, ty - 1.6 + b, 0.3, '#fff', 'center', true);
    }
  }

  private drawEffects(engine: GameEngine, dt: number): void {
    const ctx = this.ctx;
    // particules
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 3 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const [uid, v] of this.shelfFlash) {
      const nv = v - dt * 1.5;
      if (nv <= 0) this.shelfFlash.delete(uid);
      else this.shelfFlash.set(uid, nv);
    }
    // textes flottants
    for (const f of this.floats) {
      f.life -= dt;
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = Math.min(1, a * 2);
      this.worldText(f.text, f.x, f.y - (1 - a) * 0.8, 0.34, f.color, 'center', true, undefined, true);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.life > 0);
    // bulles de réaction
    const byId = new Map(engine.customers.map((c) => [c.id, c]));
    for (const b of this.bubbles) {
      b.life -= dt;
      const c = byId.get(b.customerId);
      if (!c) {
        b.life = 0;
        continue;
      }
      ctx.globalAlpha = Math.min(1, b.life * 2);
      this.drawBubble(c.x, c.y - 1.15, b.text, b.mood);
    }
    ctx.globalAlpha = 1;
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
  }

  private drawBubble(x: number, y: number, text: string, mood: 'good' | 'bad' | 'neutral'): void {
    const ctx = this.ctx;
    const px = Math.max(11, Math.min(16, this.scale * 0.3));
    const p = this.worldToScreen(x, y);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `600 ${px}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + px;
    const h = px * 1.7;
    ctx.fillStyle = mood === 'good' ? '#e9fbe9' : mood === 'bad' ? '#ffe8e8' : '#ffffff';
    ctx.strokeStyle = mood === 'good' ? '#2b9348' : mood === 'bad' ? '#d00000' : '#888';
    ctx.lineWidth = 1.5;
    roundRect(ctx, p.x - w / 2, p.y - h, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y - 1);
    ctx.lineTo(p.x, p.y + 6);
    ctx.lineTo(p.x + 4, p.y - 1);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, p.y - h / 2);
    ctx.restore();
  }

  private drawNight(engine: GameEngine): void {
    const s = engine.state;
    const m = s.minute;
    let a = 0;
    if (s.phase === 'report' || m >= BALANCE.closeTime) a = 0.35;
    else if (m > 18 * 60) a = ((m - 18 * 60) / 120) * 0.3;
    else if (m < BALANCE.openTime) a = 0.12 * (1 - (m - BALANCE.dayStart) / 60);
    if (a <= 0.01) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(20,24,60,${a})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /** Texte à taille lisible (dessiné en coordonnées écran). */
  worldText(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign,
    bold: boolean,
    bg?: string,
    outline = false,
  ): void {
    const ctx = this.ctx;
    const px = size * this.scale;
    if (px < 5) return;
    const p = this.worldToScreen(x, y);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `${bold ? '700 ' : ''}${px}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (bg) {
      const w = ctx.measureText(text).width + px * 0.8;
      ctx.fillStyle = bg;
      roundRect(ctx, p.x - (align === 'center' ? w / 2 : 0), p.y - px * 0.75, w, px * 1.5, px * 0.4);
      ctx.fill();
    }
    if (outline) {
      ctx.lineWidth = Math.max(2, px * 0.18);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(text, p.x, p.y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}
