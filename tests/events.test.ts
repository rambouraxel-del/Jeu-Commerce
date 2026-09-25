import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/engine';
import { applyEventChoice, createEventByType } from '../src/game/events/events';
import { supplierUnitCost } from '../src/game/suppliers/orders';

function e0() {
  const e = GameEngine.newGame({ seed: 61, headless: true });
  e.state.cash = 1_000_000;
  e.state.day = 10;
  return e;
}

describe('évènements', () => {
  it('influenceur positif : réputation et fréquentation', () => {
    const e = e0();
    const ev = createEventByType(e, 'influencer_good')!;
    const rep = e.state.reputation;
    const t = e.computeTraffic();
    applyEventChoice(e, ev, 0);
    expect(e.state.reputation).toBe(rep + 3);
    expect(e.computeTraffic()).toBeGreaterThan(t);
  });

  it('accord exclusif : choix entre payer (remise) ou refuser', () => {
    const e = e0();
    const ev = createEventByType(e, 'exclusive_deal')!;
    const sup = ev.data.supplierId as string;
    const pid = sup === 'grossiste' || sup === 'discount' ? 'lait' : 'lait';
    const before = supplierUnitCost(e.state, 'grossiste', pid);
    e.state.pendingEvents.push(ev);
    expect(e.resolveEvent(ev.id, 0).ok).toBe(true);
    expect(e.state.modifiers.some((m) => m.type === 'supplierDiscount')).toBe(true);
    if (sup === 'grossiste') expect(supplierUnitCost(e.state, 'grossiste', pid)).toBeLessThan(before);
    expect(e.state.pendingEvents).toHaveLength(0);
  });

  it('tendance : demande d’une catégorie temporairement en hausse puis expiration', () => {
    const e = e0();
    const ev = createEventByType(e, 'trend')!;
    applyEventChoice(e, ev, 0);
    expect(e.state.modifiers[0].daysLeft).toBe(7);
    for (let i = 0; i < 7; i++) {
      e.state.phase = 'report';
      e.nextDay();
    }
    expect(e.state.modifiers).toHaveLength(0);
  });

  it('influenceur mécontent : ignorer fait perdre de la réputation', () => {
    const e = e0();
    e.state.products.pates.soldTotal = 5;
    e.buyFurniture('etagere', 0, 0, 0);
    e.assignSlot(e.state.furniture[0].uid, 0, 'pates');
    const ev = createEventByType(e, 'influencer_bad')!;
    const rep = e.state.reputation;
    applyEventChoice(e, ev, 1);
    expect(e.state.reputation).toBe(rep - 4);
  });

  it('les évènements restent rares', () => {
    const e = GameEngine.newGame({ seed: 62, headless: true });
    let count = 0;
    for (let d = 0; d < 120; d++) {
      e.simulateDay();
      e.nextDay();
      count += e.state.pendingEvents.length;
      for (const ev of [...e.state.pendingEvents]) e.resolveEvent(ev.id, ev.choices.length - 1);
    }
    expect(count).toBeGreaterThan(1);
    expect(count).toBeLessThan(25);
  });

  it('un évènement en attente bloque le démarrage de la journée', () => {
    const e = e0();
    const ev = createEventByType(e, 'trend')!;
    e.state.pendingEvents.push(ev);
    expect(e.startDay().ok).toBe(false);
    e.resolveEvent(ev.id, 0);
    expect(e.startDay().ok).toBe(true);
  });
});
