import { FURNITURE_MAP } from '../../data/furniture';
import { STORE_LEVELS, type StoreLevelDef } from '../../data/store';
import type { FurnitureDef, PlacedFurniture } from '../types';

export interface Cell {
  x: number;
  y: number;
}

export function levelDef(level: number): StoreLevelDef {
  return STORE_LEVELS[Math.max(0, Math.min(STORE_LEVELS.length - 1, level - 1))];
}

export interface StoreGeometry {
  w: number;
  h: number;
  doorX: number;
  checkouts: Cell[]; // cases comptoir (rangée du bas)
  payCells: Cell[]; // cases où le client paie
  avatarHome: Cell;
  desk: Cell;
  serviceDoor: Cell; // dernière case intérieure avant la porte de service
  truckSpot: { x: number; y: number };
}

export function geometry(level: number): StoreGeometry {
  const def = levelDef(level);
  const w = def.w;
  const h = def.h;
  const doorX = Math.floor(w / 2);
  const candidates: number[] = [];
  for (let k = 1; k < w; k++) {
    candidates.push(doorX - 2 * k, doorX + 2 * k);
  }
  const xs = candidates.filter((x) => x >= 0 && x <= w - 3).slice(0, def.checkouts);
  const checkouts = xs.map((x) => ({ x, y: h - 1 }));
  const payCells = xs.map((x) => ({ x, y: h - 2 }));
  return {
    w,
    h,
    doorX,
    checkouts,
    payCells,
    avatarHome: { x: checkouts[0].x + 1, y: h - 1 },
    desk: { x: w - 1, y: h - 1 },
    serviceDoor: { x: w - 1, y: h - 2 },
    truckSpot: { x: w - 1.7, y: h + 2.4 },
  };
}

/** Zone fixe : les deux dernières rangées (accueil, caisses, entrée). */
export function isFixedZone(level: number, y: number): boolean {
  const { h } = levelDef(level);
  return y >= h - 2;
}

export function footprint(f: { defId: string; x: number; y: number; rot: 0 | 1 }): { w: number; h: number } {
  const def = FURNITURE_MAP[f.defId];
  return f.rot ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export function furnitureCells(f: { defId: string; x: number; y: number; rot: 0 | 1 }): Cell[] {
  const { w, h } = footprint(f);
  const out: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: f.x + dx, y: f.y + dy });
  return out;
}

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly blocked: Uint8Array;
  /** uid du meuble occupant chaque case (0 = aucun). */
  readonly owner: Int32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.blocked = new Uint8Array(w * h);
    this.owner = new Int32Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inside(x, y) && this.blocked[y * this.w + x] === 0;
  }
}

export function buildGrid(level: number, furniture: PlacedFurniture[], ignoreUid = -1): Grid {
  const geo = geometry(level);
  const grid = new Grid(geo.w, geo.h);
  // rangée du bas bloquée sauf la porte
  for (let x = 0; x < geo.w; x++) {
    if (x !== geo.doorX) grid.blocked[(geo.h - 1) * geo.w + x] = 1;
  }
  for (const f of furniture) {
    if (f.uid === ignoreUid) continue;
    for (const c of furnitureCells(f)) {
      if (grid.inside(c.x, c.y)) {
        grid.blocked[c.y * geo.w + c.x] = 1;
        grid.owner[c.y * geo.w + c.x] = f.uid;
      }
    }
  }
  return grid;
}

/** Cases accessibles autour d'un meuble, par ordre de préférence (devant d'abord). */
export function accessCells(f: PlacedFurniture, grid: Grid): Cell[] {
  const { w, h } = footprint(f);
  const front: Cell[] = [];
  const sides: Cell[] = [];
  const back: Cell[] = [];
  for (let dx = 0; dx < w; dx++) {
    front.push({ x: f.x + dx, y: f.y + h });
    back.push({ x: f.x + dx, y: f.y - 1 });
  }
  for (let dy = 0; dy < h; dy++) {
    sides.push({ x: f.x - 1, y: f.y + dy }, { x: f.x + w, y: f.y + dy });
  }
  return [...front, ...sides, ...back].filter((c) => grid.isWalkable(c.x, c.y));
}

export function reachableFromDoor(level: number, grid: Grid): Uint8Array {
  const geo = geometry(level);
  const seen = new Uint8Array(grid.w * grid.h);
  const stack: number[] = [(geo.h - 1) * grid.w + geo.doorX];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % grid.w;
    const y = (i - x) / grid.w;
    const nb = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (!grid.isWalkable(nx, ny)) continue;
      const j = ny * grid.w + nx;
      if (seen[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

export type PlacementError =
  | 'outside'
  | 'fixedZone'
  | 'overlap'
  | 'blocksAccess'
  | 'noAccess'
  | 'locked';

export const PLACEMENT_MESSAGES: Record<PlacementError, string> = {
  outside: 'En dehors du magasin',
  fixedZone: 'Zone d’accueil réservée (entrée et caisses)',
  overlap: 'Emplacement déjà occupé',
  blocksAccess: 'Ce placement bloquerait l’accès à un rayon',
  noAccess: 'Ce rayon ne serait pas accessible aux clients',
  locked: 'Non débloqué',
};

/**
 * Vérifie qu'un meuble peut être placé (ou déplacé si `moving`),
 * y compris la connectivité : tous les rayons doivent rester accessibles.
 */
export function validatePlacement(
  level: number,
  furniture: PlacedFurniture[],
  candidate: { defId: string; x: number; y: number; rot: 0 | 1 },
  movingUid = -1,
): PlacementError | null {
  const geo = geometry(level);
  const cells = furnitureCells(candidate);
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= geo.w || c.y >= geo.h) return 'outside';
    if (isFixedZone(level, c.y)) return 'fixedZone';
  }
  const others = furniture.filter((f) => f.uid !== movingUid);
  const grid = buildGrid(level, others);
  for (const c of cells) if (!grid.isWalkable(c.x, c.y)) return 'overlap';

  const placed: PlacedFurniture = { uid: -999, defId: candidate.defId, x: candidate.x, y: candidate.y, rot: candidate.rot, slots: [] };
  const all = [...others, placed];
  const g2 = buildGrid(level, all);
  const reach = reachableFromDoor(level, g2);
  for (const f of all) {
    const def = FURNITURE_MAP[f.defId];
    if (def.kind !== 'shelf') continue;
    const ok = accessCells(f, g2).some((c) => reach[c.y * g2.w + c.x]);
    if (!ok) return f.uid === -999 ? 'noAccess' : 'blocksAccess';
  }
  return null;
}

/** Cases libres/interdites pour l'affichage en mode aménagement. */
export function placementMap(level: number, furniture: PlacedFurniture[], movingUid = -1): Uint8Array {
  const geo = geometry(level);
  const grid = buildGrid(level, furniture.filter((f) => f.uid !== movingUid));
  const out = new Uint8Array(geo.w * geo.h);
  for (let y = 0; y < geo.h; y++)
    for (let x = 0; x < geo.w; x++) {
      const i = y * geo.w + x;
      out[i] = isFixedZone(level, y) || !grid.isWalkable(x, y) ? 0 : 1;
    }
  return out;
}

/** Translation des meubles lors d'un agrandissement (le magasin grandit vers le haut et les côtés). */
export function expansionOffset(fromLevel: number, toLevel: number): { dx: number; dy: number } {
  const a = levelDef(fromLevel);
  const b = levelDef(toLevel);
  return { dx: Math.floor((b.w - a.w) / 2), dy: b.h - a.h };
}

export function furnitureDef(f: PlacedFurniture): FurnitureDef {
  return FURNITURE_MAP[f.defId];
}

/** Recherche d'un emplacement libre valide pour un meuble (utilisé par le bot et l'assistant de placement). */
export function findFreeSpot(
  level: number,
  furniture: PlacedFurniture[],
  defId: string,
): { x: number; y: number; rot: 0 | 1 } | null {
  const geo = geometry(level);
  // Recherche en rangées espacées (allées) d'abord, depuis le fond du magasin.
  for (const rot of [0, 1] as const) {
    for (let y = 0; y < geo.h - 2; y++) {
      for (let x = 0; x < geo.w; x++) {
        const cand = { defId, x, y, rot };
        if (validatePlacement(level, furniture, cand) === null) {
          // éviter de coller un rayon juste devant un autre si possible (préférer y pair)
          return cand;
        }
      }
    }
  }
  return null;
}
