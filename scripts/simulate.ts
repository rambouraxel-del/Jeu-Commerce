// Simulations d'équilibrage : plusieurs stratégies jouées automatiquement.
// Usage : npm run sim -- [jours=120] [stratégie1,stratégie2,...]

import { runBot, STRATEGIES } from '../src/game/bot/bot';
import { GameEngine } from '../src/game/engine';

const days = Number(process.argv[2] ?? 120);
const only = process.argv[3]?.split(',');
const seeds = [11, 23];

interface Row {
  name: string;
  cash: number;
  revenue: number;
  profit: number;
  level: number;
  store: number;
  rep: number;
  share: number;
  sat: number;
  dayL2: number | null;
  dayL3: number | null;
  dayL4: number | null;
  bankrupt: boolean;
}

const rows: Row[] = [];
const t0 = Date.now();
for (const [key, strat] of Object.entries(STRATEGIES)) {
  if (only && !only.includes(key)) continue;
  const acc: Row[] = [];
  for (const seed of seeds) {
    const e = GameEngine.newGame({ seed, headless: true });
    const reached: Record<number, number> = {};
    runBot(e, strat, days, (d) => {
      const lvl = e.state.storeLevel;
      if (!reached[lvl]) reached[lvl] = d;
    });
    const s = e.state;
    const last30 = s.history.slice(-30);
    acc.push({
      name: strat.name,
      cash: s.cash / 100,
      revenue: s.totalRevenue / 100,
      profit: s.totalProfit / 100,
      level: s.level,
      store: s.storeLevel,
      rep: s.reputation,
      share: s.marketShare * 100,
      sat: last30.reduce((a, r) => a + r.satisfaction, 0) / Math.max(1, last30.length),
      dayL2: reached[2] ?? null,
      dayL3: reached[3] ?? null,
      dayL4: reached[4] ?? null,
      bankrupt: s.bankrupt,
    });
  }
  const avg = (f: (r: Row) => number) => acc.reduce((a, r) => a + f(r), 0) / acc.length;
  const avgDay = (f: (r: Row) => number | null) => {
    const v = acc.map(f).filter((x): x is number => x !== null);
    return v.length === acc.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  rows.push({
    name: strat.name,
    cash: avg((r) => r.cash),
    revenue: avg((r) => r.revenue),
    profit: avg((r) => r.profit),
    level: avg((r) => r.level),
    store: avg((r) => r.store),
    rep: avg((r) => r.rep),
    share: avg((r) => r.share),
    sat: avg((r) => r.sat),
    dayL2: avgDay((r) => r.dayL2),
    dayL3: avgDay((r) => r.dayL3),
    dayL4: avgDay((r) => r.dayL4),
    bankrupt: acc.some((r) => r.bankrupt),
  });
}

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ');
console.log(`\nSimulation : ${days} jours × ${seeds.length} graines (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
console.log(
  ['Stratégie'.padEnd(38), 'CA cumulé'.padStart(12), 'Résultat'.padStart(11), 'Tréso'.padStart(11), 'Niv'.padStart(4), 'Mag'.padStart(4), 'Rép'.padStart(5), 'Sat'.padStart(5), 'PdM%'.padStart(6), 'J→M2'.padStart(5), 'J→M3'.padStart(5), 'J→M4'.padStart(5)].join(' '),
);
for (const r of rows.sort((a, b) => b.revenue - a.revenue)) {
  console.log(
    [
      (r.name + (r.bankrupt ? ' ☠' : '')).padEnd(38),
      fmt(r.revenue).padStart(12),
      fmt(r.profit).padStart(11),
      fmt(r.cash).padStart(11),
      r.level.toFixed(1).padStart(4),
      r.store.toFixed(1).padStart(4),
      r.rep.toFixed(0).padStart(5),
      r.sat.toFixed(0).padStart(5),
      r.share.toFixed(1).padStart(6),
      String(r.dayL2 ?? '—').padStart(5),
      String(r.dayL3 ?? '—').padStart(5),
      String(r.dayL4 ?? '—').padStart(5),
    ].join(' '),
  );
}
