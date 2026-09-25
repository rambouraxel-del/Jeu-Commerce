import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { deleteSave, hasSave, loadGame, migrate, saveGame, type Storage } from '../src/save/save';
import { setupStore, finishDay } from './helpers';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('sauvegarde', () => {
  it('sauvegarde et recharge l’intégralité de l’état', () => {
    const e = setupStore(51);
    finishDay(e);
    e.nextDay();
    e.launchCampaign('flyers');
    e.createPromotion('category', 'epicerie', 0.1, 3);
    e.setStoreName('Super Test');
    const mem = new MemoryStorage();
    expect(saveGame(e.serialize(), mem)).toBe(true);
    expect(hasSave(mem)).toBe(true);
    const loaded = loadGame(mem)!;
    expect(loaded).not.toBeNull();
    const e2 = new GameEngine(loaded, { headless: true });
    const a = JSON.parse(e.serialize());
    const b = JSON.parse(e2.serialize());
    expect(b).toEqual(a);
    expect(e2.state.customization.storeName).toBe('Super Test');
    expect(e2.state.campaigns).toHaveLength(1);
    expect(e2.state.history).toHaveLength(1);
  });

  it('la simulation reprend de façon déterministe après rechargement', () => {
    const e = setupStore(52);
    finishDay(e);
    e.nextDay();
    const copy = new GameEngine(migrate(JSON.parse(e.serialize()))!, { headless: true });
    e.simulateDay();
    copy.simulateDay();
    expect(copy.state.history[1].revenue).toBe(e.state.history[1].revenue);
    expect(copy.state.cash).toBe(e.state.cash);
  });

  it('répare une sauvegarde incomplète et rejette une sauvegarde corrompue', () => {
    const e = GameEngine.newGame({ seed: 53, headless: true });
    const raw = JSON.parse(e.serialize());
    delete raw.customization.signStyle;
    delete raw.products.lait;
    delete raw.lifetime;
    const fixed = migrate(raw)!;
    expect(fixed.customization.signStyle).toBe(0);
    expect(fixed.products.lait.price).toBeGreaterThan(0);
    expect(fixed.lifetime.customers).toBe(0);
    expect(migrate({ foo: 1 })).toBeNull();
    const mem = new MemoryStorage();
    mem.setItem('commerce-save-v1', '{pas du json');
    expect(loadGame(mem)).toBeNull();
  });

  it('suppression de la sauvegarde', () => {
    const mem = new MemoryStorage();
    saveGame('{}', mem);
    deleteSave(mem);
    expect(hasSave(mem)).toBe(false);
  });

  it('une journée interrompue reprend sans clients fantômes', () => {
    const e = setupStore(54);
    e.tick(200);
    const e2 = new GameEngine(migrate(JSON.parse(e.serialize()))!, { headless: true });
    expect(e2.customers).toHaveLength(0);
    expect(e2.state.phase).toBe('running');
    finishDay(e2);
    expect(e2.state.phase).toBe('report');
  });
});
