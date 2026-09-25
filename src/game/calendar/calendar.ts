import {
  CALENDAR_EVENTS,
  DAYS_PER_MONTH,
  MONTH_NAMES,
  SEASON_DEMAND,
  START_MONTH,
  WEEKDAY_NAMES,
  WEEKDAY_TRAFFIC,
  type CalendarEventDef,
  type Season,
} from '../../data/calendar';
import type { CategoryId } from '../types';

export interface DateInfo {
  day: number;
  year: number;
  month: number; // 0-11
  dayOfMonth: number; // 1..14
  weekday: number; // 0 = lundi
  season: Season;
  label: string;
  short: string;
}

export function dateInfo(day: number): DateInfo {
  const idx = day - 1;
  const monthsElapsed = Math.floor(idx / DAYS_PER_MONTH) + START_MONTH;
  const month = monthsElapsed % 12;
  const year = 1 + Math.floor(monthsElapsed / 12);
  const dayOfMonth = (idx % DAYS_PER_MONTH) + 1;
  const weekday = idx % 7;
  const season: Season =
    month === 11 || month <= 1 ? 'hiver' : month <= 4 ? 'printemps' : month <= 7 ? 'ete' : 'automne';
  return {
    day,
    year,
    month,
    dayOfMonth,
    weekday,
    season,
    label: `${WEEKDAY_NAMES[weekday]} ${dayOfMonth} ${MONTH_NAMES[month]} — An ${year}`,
    short: `${WEEKDAY_NAMES[weekday].slice(0, 3)}. ${dayOfMonth} ${MONTH_NAMES[month].slice(0, 4)}.`,
  };
}

/** Nouveau mois : le jour est le premier du mois (hors jour 1). */
export function isMonthStart(day: number): boolean {
  return day > 1 && (day - 1) % DAYS_PER_MONTH === 0;
}

export function activeCalendarEvents(day: number): CalendarEventDef[] {
  const d = dateInfo(day);
  return CALENDAR_EVENTS.filter((e) => e.month === d.month && d.dayOfMonth >= e.from && d.dayOfMonth <= e.to);
}

export function upcomingCalendarEvents(day: number, horizon = 28): { event: CalendarEventDef; inDays: number }[] {
  const out: { event: CalendarEventDef; inDays: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i <= horizon; i++) {
    for (const e of activeCalendarEvents(day + i)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ event: e, inDays: i });
    }
  }
  return out;
}

export function calendarTraffic(day: number): number {
  const d = dateInfo(day);
  let t = WEEKDAY_TRAFFIC[d.weekday];
  for (const e of activeCalendarEvents(day)) t *= e.traffic;
  return t;
}

export function calendarPromoSensitivity(day: number): number {
  let s = 1;
  for (const e of activeCalendarEvents(day)) s *= e.promoSensitivity;
  return s;
}

export function calendarCategoryDemand(day: number, category: CategoryId): number {
  const d = dateInfo(day);
  let m = SEASON_DEMAND[d.season][category] ?? 1;
  for (const e of activeCalendarEvents(day)) m *= e.demand[category] ?? 1;
  return m;
}
