import { describe, expect, it } from 'vitest';
import {
  activeCalendarEvents,
  calendarCategoryDemand,
  calendarPromoSensitivity,
  calendarTraffic,
  dateInfo,
  isMonthStart,
} from '../src/game/calendar/calendar';
import { DAYS_PER_MONTH } from '../src/data/calendar';

/** Jour de jeu correspondant à (mois, jour du mois) de l'an 1 (le jeu commence en mars). */
function dayOf(month: number, dom: number): number {
  const m = (month - 2 + 12) % 12;
  return m * DAYS_PER_MONTH + dom;
}

describe('calendrier', () => {
  it('commence un lundi 1er mars de l’an 1, au printemps', () => {
    const d = dateInfo(1);
    expect(d).toMatchObject({ month: 2, dayOfMonth: 1, weekday: 0, year: 1, season: 'printemps' });
  });

  it('enchaîne mois et années', () => {
    expect(dateInfo(DAYS_PER_MONTH + 1).month).toBe(3);
    expect(dateInfo(10 * DAYS_PER_MONTH + 1)).toMatchObject({ month: 0, year: 2 });
    expect(isMonthStart(DAYS_PER_MONTH + 1)).toBe(true);
    expect(isMonthStart(5)).toBe(false);
  });

  it('rentrée : papeterie en hausse', () => {
    const d = dayOf(8, 3);
    expect(activeCalendarEvents(d).some((e) => e.id === 'rentree2')).toBe(true);
    expect(calendarCategoryDemand(d, 'papeterie')).toBeGreaterThan(2);
  });

  it('Noël : technologie, loisirs et vêtements en hausse', () => {
    const d = dayOf(11, 5);
    expect(calendarCategoryDemand(d, 'technologie')).toBeGreaterThan(1.5);
    expect(calendarCategoryDemand(d, 'loisirs')).toBeGreaterThan(1.5);
    expect(calendarCategoryDemand(d, 'vetements')).toBeGreaterThan(1.2);
  });

  it('été : boissons en hausse', () => {
    const d = dayOf(6, 12);
    expect(dateInfo(d).season).toBe('ete');
    expect(calendarCategoryDemand(d, 'boissons')).toBeGreaterThan(1.3);
  });

  it('Black Friday : fréquentation et sensibilité aux promos très fortes', () => {
    const d = dayOf(10, 12);
    const normal = dayOf(10, 5);
    expect(calendarTraffic(d) / calendarTraffic(normal)).toBeGreaterThan(1.3);
    expect(calendarPromoSensitivity(d)).toBeGreaterThan(2);
  });

  it('le samedi est plus fréquenté que le lundi', () => {
    expect(calendarTraffic(6)).toBeGreaterThan(calendarTraffic(1));
  });
});
