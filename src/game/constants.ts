// Constantes d'équilibrage centralisées.

export const SAVE_VERSION = 1;

export const BALANCE = {
  startCash: 150000, // 1 500 €
  startReputation: 30,
  maxLevel: 20,

  // Temps (minutes depuis minuit)
  dayStart: 7 * 60, // préparation
  openTime: 8 * 60,
  closeTime: 20 * 60,
  /** Minutes de jeu par seconde réelle à la vitesse x1. */
  gameMinutesPerSecond: 4,

  // Déplacements (cases par minute de jeu)
  customerSpeed: 0.55,
  avatarSpeed: 0.9,
  browseMinutes: [2, 5] as [number, number],
  payBaseMinutes: 1.0,
  payPerItemMinutes: 0.22,
  selfCheckoutSlowdown: 1.25,
  queuePatience: 12,

  // Trafic journalier : baseTraffic(niveau) × réputation × variété × marketing × calendrier
  repTrafficMin: 0.5,
  repTrafficMax: 1.3,
  varietyMin: 0.5,
  varietyMax: 1.25,
  hourlyTraffic: [0.55, 0.75, 0.95, 1.15, 1.35, 1.05, 0.8, 0.8, 0.95, 1.25, 1.4, 0.9] as number[], // 8h..19h

  // Courbe prix
  priceElasticity: 1.9,
  priceDiscountCap: 0.8,
  abusiveRatio: 1.6,
  baseConversion: 0.8,
  impulseChance: 0.1,
  wantInStoreChance: 0.86,

  // Qualité
  qualityPivot: 55,
  qualityConversionWeight: 0.8,
  qualityPriceTolerance: 260,

  // Satisfaction & réputation
  satisfactionStart: 62,
  reputationDriftRate: 0.045,
  reputationMaxDailyChange: 2.5,
  ambianceSatisfactionCap: 10,

  // Charges journalières
  baseElectricity: 400,
  maintenancePerFurniture: 60,
  baseMaintenance: 200,
  taxRate: 0.03,
  reserveOverflowCostPerUnit: 5,

  // Prix de revente d'un meuble
  resellRatio: 0.5,

  // Faillite
  bankruptcyDays: 12,
  bankruptcyThresholdPerLevel: 150000,

  // Progression XP : XP totale requise = xpA × (niveau−1)^xpB
  xpA: 70,
  xpB: 3.1,
  /** XP gagnée par euro de marge brute. */
  xpPerEuroMargin: 1,

  // Popularité produits
  popularityGain: 0.004,
  popularityDecay: 0.01,

  // Évènements
  eventChance: 0.09,
  eventMinGap: 5,

  // Promotions
  promoDemandBoost: 0.9,
};

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(BALANCE.xpA * Math.pow(level - 1, BALANCE.xpB));
}
