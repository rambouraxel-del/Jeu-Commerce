// Le moteur fonctionne sans interface et peut simuler des centaines de journées.
import { describe, expect, it } from 'vitest';
import { runBot, STRATEGIES } from '../src/game/bot/bot';
import { GameEngine } from '../src/game/engine';

function hasNaN(v: unknown): boolean {
  if (typeof v === 'number') return !Number.isFinite(v);
  if (Array.isArray(v)) return v.some(hasNaN);
  if (v && typeof v === 'object') return Object.values(v).some(hasNaN);
  return false;
}

describe('simulation longue sans interface', () => {
  it('simule 250 journées sans erreur et fait grandir le magasin', () => {
    const e = GameEngine.newGame({ seed: 2024, headless: true });
    const t0 = Date.now();
    runBot(e, STRATEGIES.market, 250);
    const s = e.state;
    expect(s.day).toBeGreaterThanOrEqual(250);
    expect(s.bankrupt).toBe(false);
    expect(s.storeLevel).toBeGreaterThanOrEqual(5);
    expect(s.unlockedCategories).toContain('technologie');
    expect(s.marketReports.length).toBeGreaterThan(15);
    expect(hasNaN(JSON.parse(e.serialize()))).toBe(false);
    expect(Date.now() - t0).toBeLessThan(170000);
  }, 180000);
});
