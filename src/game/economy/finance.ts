import { FURNITURE_MAP } from '../../data/furniture';
import { BALANCE } from '../constants';
import { levelDef } from '../store/layout';
import { reserveCapacity, reserveUsed } from '../store/stock';
import type { Cents, GameState } from '../types';

export interface DailyCharges {
  rent: Cents;
  electricity: Cents;
  maintenance: Cents;
  storage: Cents;
  taxes: Cents;
  total: Cents;
}

/** Charges fixes journalières (hors taxes proportionnelles au CA). */
export function dailyCharges(state: GameState, revenue: Cents): DailyCharges {
  const rent = levelDef(state.storeLevel).rent;
  let electricity = BALANCE.baseElectricity * state.storeLevel;
  for (const f of state.furniture) electricity += FURNITURE_MAP[f.defId].power ?? 0;
  if (state.upgrades.includes('aircon')) electricity += 800 * state.storeLevel;
  if (state.upgrades.includes('lighting')) electricity = Math.round(electricity * 0.85);
  const maintenance = BALANCE.baseMaintenance * state.storeLevel + BALANCE.maintenancePerFurniture * state.furniture.length;
  const overflow = Math.max(0, reserveUsed(state) - reserveCapacity(state));
  const storage = overflow * BALANCE.reserveOverflowCostPerUnit;
  const taxes = Math.round(Math.max(0, revenue) * BALANCE.taxRate);
  return { rent, electricity, maintenance, storage, taxes, total: rent + electricity + maintenance + storage + taxes };
}

export function ambianceScore(state: GameState): number {
  let a = 0;
  for (const f of state.furniture) a += FURNITURE_MAP[f.defId].ambiance ?? 0;
  if (state.upgrades.includes('lighting')) a += 6;
  a += state.customization.floorStyle * 2 + state.customization.wallStyle * 1.5 + state.customization.signStyle * 1.5;
  return a;
}

/** Ambiance relative à la surface : bonus de satisfaction (0 → plafond). */
export function ambianceSatisfaction(state: GameState): number {
  const def = levelDef(state.storeLevel);
  const area = def.w * (def.h - 2);
  const density = ambianceScore(state) / (area * 0.35);
  return BALANCE.ambianceSatisfactionCap * Math.min(1, density);
}
