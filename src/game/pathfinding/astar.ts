import type { Grid } from '../store/layout';

export interface Point {
  x: number;
  y: number;
}

/** Tas binaire minimal pour A*. */
class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, p: number): void {
    const a = this.items;
    const pr = this.prio;
    a.push(item);
    pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [pr[parent], pr[i]] = [pr[i], pr[parent]];
      i = parent;
    }
  }

  pop(): number {
    const a = this.items;
    const pr = this.prio;
    const top = a[0];
    const lastI = a.pop()!;
    const lastP = pr.pop()!;
    if (a.length > 0) {
      a[0] = lastI;
      pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;

/**
 * A* sur grille, 8 directions sans couper les coins.
 * Renvoie la liste des centres de cases (hors case de départ), ou null si inaccessible.
 */
export function findPath(grid: Grid, from: Point, to: Point): Point[] | null {
  const w = grid.w;
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const tx = Math.floor(to.x);
  const ty = Math.floor(to.y);
  if (!grid.inside(tx, ty) || !grid.inside(sx, sy)) return null;
  if (!grid.isWalkable(tx, ty)) return null;
  const start = sy * w + sx;
  const goal = ty * w + tx;
  if (start === goal) return [];

  const n = w * grid.h;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap();
  const h = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };
  g[start] = 0;
  heap.push(start, h(start));
  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        // la case de départ peut être bloquée (client dans un meuble) mais pas les voisines
        if (!grid.isWalkable(nx, ny)) continue;
        if (dx && dy && (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const cost = g[cur] + (dx && dy ? SQRT2 : 1);
        if (cost < g[ni]) {
          g[ni] = cost;
          came[ni] = cur;
          heap.push(ni, cost + h(ni));
        }
      }
    }
  }
  if (came[goal] === -1) return null;
  const out: Point[] = [];
  let c = goal;
  while (c !== start && c !== -1) {
    const x = c % w;
    out.push({ x: x + 0.5, y: (c - x) / w + 0.5 });
    c = came[c];
  }
  out.reverse();
  return out;
}

export function pathLength(from: Point, path: Point[]): number {
  let len = 0;
  let px = from.x;
  let py = from.y;
  for (const p of path) {
    len += Math.hypot(p.x - px, p.y - py);
    px = p.x;
    py = p.y;
  }
  return len;
}
