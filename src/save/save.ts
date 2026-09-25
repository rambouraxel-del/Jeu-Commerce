// Sauvegarde locale (localStorage). Tout l'état de la partie est sérialisé en JSON.

import { PRODUCTS } from '../data/products';
import { SAVE_VERSION } from '../game/constants';
import { createNewGame, initialProductState } from '../game/state';
import type { GameState } from '../game/types';

export const SAVE_KEY = 'commerce-save-v1';
export const PREFS_KEY = 'commerce-prefs';

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Complète/répare un état chargé (versions précédentes, champs manquants). */
export function migrate(raw: any): GameState | null {
  if (!raw || typeof raw !== 'object' || typeof raw.day !== 'number' || !Array.isArray(raw.furniture)) return null;
  const base = createNewGame({ seed: raw.seed ?? 1 });
  const s: GameState = { ...base, ...raw };
  s.customization = { ...base.customization, ...(raw.customization ?? {}) };
  s.settings = { ...base.settings, ...(raw.settings ?? {}) };
  s.lifetime = { ...base.lifetime, ...(raw.lifetime ?? {}) };
  s.tutorial = { ...base.tutorial, ...(raw.tutorial ?? {}) };
  s.today = { ...base.today, ...(raw.today ?? {}) };
  for (const p of PRODUCTS) {
    s.products[p.id] = { ...initialProductState(p.id), ...(raw.products?.[p.id] ?? {}) };
  }
  for (const f of s.furniture) f.slots = f.slots.filter((sl) => !sl.productId || s.products[sl.productId]);
  // Les clients ne sont pas sauvegardés : une journée interrompue reprend sans clients présents.
  s.version = SAVE_VERSION;
  return s;
}

export function saveGame(json: string, storage: Storage | null = store()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: Storage | null = store()): GameState | null {
  if (!storage) return null;
  try {
    const txt = storage.getItem(SAVE_KEY);
    if (!txt) return null;
    return migrate(JSON.parse(txt));
  } catch {
    return null;
  }
}

export function hasSave(storage: Storage | null = store()): boolean {
  try {
    return !!storage?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function deleteSave(storage: Storage | null = store()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export interface Prefs {
  sound: boolean;
}

export function loadPrefs(): Prefs {
  try {
    const t = store()?.getItem(PREFS_KEY);
    if (t) return { sound: true, ...JSON.parse(t) };
  } catch {
    /* ignore */
  }
  return { sound: true };
}

export function savePrefs(p: Prefs): void {
  try {
    store()?.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
