import { dateInfo } from '../calendar/calendar';
import type { Rng } from '../rng';
import type { CategoryId, DayRecord, GameState, MarketReport } from '../types';

function score(revenue: number, reputation: number, priceIndex: number): number {
  const repF = 0.75 + 0.5 * (reputation / 100);
  const priceF = Math.max(0.6, 1.15 - 0.6 * (priceIndex - 1));
  return revenue * repF * priceF;
}

/**
 * Rapport de marché mensuel. La part de marché dépend du CA, de la réputation,
 * du niveau de prix, de l'offre (variété) et du marketing du joueur.
 */
export function computeMarketReport(state: GameState, monthRecords: DayRecord[], rng: Rng, variety: number, marketingDays: number): MarketReport {
  const revenue = monthRecords.reduce((a, r) => a + r.revenue, 0);
  const priceIndex =
    revenue > 0 ? monthRecords.reduce((a, r) => a + r.priceIndex * r.revenue, 0) / revenue : 1;
  const offerF = 0.85 + 0.3 * Math.min(1, variety);
  const mktF = 1 + Math.min(0.15, marketingDays * 0.01);
  const playerScore = score(revenue, state.reputation, priceIndex) * offerF * mktF;

  const prevShare = state.marketShare;
  // Les concurrents évoluent : croissance propre, bruit, et pression du joueur.
  for (const c of state.competitors) {
    const pressure = Math.max(0, prevShare - 0.02) * 0.08;
    c.monthlyRevenue = Math.round(c.monthlyRevenue * (1 + c.growth + rng.range(-0.02, 0.02) - pressure));
    c.priceIndex = Math.max(0.8, Math.min(1.3, c.priceIndex + rng.range(-0.01, 0.01)));
    c.reputation = Math.max(20, Math.min(95, c.reputation + rng.range(-1, 1)));
  }
  const compScores = state.competitors.map((c) => score(c.monthlyRevenue, c.reputation, c.priceIndex));
  const total = playerScore + compScores.reduce((a, b) => a + b, 0);
  const share = total > 0 ? playerScore / total : 0;

  const catTotals: Partial<Record<CategoryId, number>> = {};
  for (const r of monthRecords)
    for (const k in r.categoryRevenue) {
      const cat = k as CategoryId;
      catTotals[cat] = (catTotals[cat] ?? 0) + (r.categoryRevenue[cat] ?? 0);
    }
  const topCategories = (Object.entries(catTotals) as [CategoryId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, rev]) => ({ category, revenue: rev }));

  const all = [...state.competitors.map((c) => ({ p: c.priceIndex, r: c.reputation, w: c.monthlyRevenue }))];
  const wsum = all.reduce((a, x) => a + x.w, 0) || 1;
  const d = dateInfo(Math.max(1, state.day - 1));
  return {
    month: d.month,
    year: d.year,
    day: state.day,
    playerRevenue: revenue,
    playerShare: share,
    previousShare: prevShare,
    playerPriceIndex: priceIndex,
    playerReputation: state.reputation,
    competitors: state.competitors.map((c, i) => ({
      id: c.id,
      name: c.name,
      share: total > 0 ? compScores[i] / total : 0,
      priceIndex: c.priceIndex,
      reputation: c.reputation,
      color: c.color,
    })),
    topCategories,
    marketAvgPrice: all.reduce((a, x) => a + x.p * x.w, 0) / wsum,
    marketAvgReputation: all.reduce((a, x) => a + x.r * x.w, 0) / wsum,
  };
}
