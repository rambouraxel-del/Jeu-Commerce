// Génère une sauvegarde avancée (bot) pour tester le rendu d'un grand magasin.
// Usage : npx tsx scripts/demo-save.ts [jours=150] > demo-save.json
import { runBot, STRATEGIES } from '../src/game/bot/bot';
import { GameEngine } from '../src/game/engine';

const days = Number(process.argv[2] ?? 150);
const e = GameEngine.newGame({ seed: 77, headless: true, storeName: 'Hyper Démo' });
runBot(e, STRATEGIES.market, days);
e.state.tutorial = { active: false, step: 8, done: true };
e.state.pendingEvents = [];
if (e.state.phase === 'report') e.nextDay();
e.state.pendingEvents = [];
process.stdout.write(e.serialize());
