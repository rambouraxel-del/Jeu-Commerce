import { describe, expect, it } from 'vitest';
import { findPath } from '../src/game/pathfinding/astar';
import { Grid } from '../src/game/store/layout';

function gridFrom(rows: string[]): Grid {
  const g = new Grid(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => (g.blocked[y * g.w + x] = ch === '#' ? 1 : 0)));
  return g;
}

describe('A*', () => {
  it('trouve un chemin en ligne droite', () => {
    const g = gridFrom(['.....']);
    const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p).toHaveLength(4);
    expect(p[p.length - 1]).toEqual({ x: 4.5, y: 0.5 });
  });

  it('contourne les obstacles', () => {
    const g = gridFrom(['.....', '.###.', '.....']);
    const p = findPath(g, { x: 0, y: 1 }, { x: 4, y: 1 })!;
    expect(p).not.toBeNull();
    for (const pt of p) expect(g.isWalkable(Math.floor(pt.x), Math.floor(pt.y))).toBe(true);
  });

  it('ne coupe pas les coins', () => {
    const g = gridFrom(['.#', '..']);
    const p = findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })!;
    expect(p.length).toBe(2); // doit passer par (0,1)
  });

  it('renvoie null si la destination est inaccessible', () => {
    const g = gridFrom(['..#..', '..#..', '..#..']);
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('renvoie un chemin vide si on est déjà arrivé', () => {
    const g = gridFrom(['...']);
    expect(findPath(g, { x: 1, y: 0 }, { x: 1.4, y: 0.6 })).toEqual([]);
  });
});
