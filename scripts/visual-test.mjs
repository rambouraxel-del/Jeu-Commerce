// Test visuel et fonctionnel de bout en bout (Chromium via playwright-core).
// Usage : npm run build && npm run test:visual
// Lance `vite preview`, joue une partie sur 3 résolutions et vérifie :
// absence d'erreurs, pas de débordement horizontal, boutons assez grands,
// panneaux accessibles, sauvegarde + rechargement.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const exe =
  process.env.CHROMIUM_PATH ||
  ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => existsSync(p));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

const VIEWPORTS = [
  { name: 'iphone-390x844', width: 390, height: 844, mobile: true },
  { name: 'android-430x932', width: 430, height: 932, mobile: true },
  { name: 'desktop-1280x800', width: 1280, height: 800, mobile: false },
];

async function dismiss(page) {
  for (let i = 0; i < 6; i++) {
    const btn = page.locator('.modal .btn').filter({ hasText: /Super|Génial|Compris|Fermer|Découvrir|Tant pis|Refuser|Décliner|OK/ }).last();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(150);
    } else break;
  }
}

async function noOverflow(page, label) {
  const o = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
  check(o.doc <= 0 && o.body <= 0, `${label} : pas de débordement horizontal (${o.doc}px)`);
}

async function buttonSizes(page, label) {
  const small = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(b);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      if (r.height < 32 || r.width < 32) out.push(`${b.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  check(small.length === 0, `${label} : boutons ≥ 32px ${small.length ? '(' + small.slice(0, 5).join(', ') + ')' : ''}`);
}

async function buttonsInViewport(page, label) {
  const off = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('.bottom-nav button, .hud button, .fabs button, .store-actions button')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1) out.push(b.textContent?.trim().slice(0, 20));
    }
    return out;
  });
  check(off.length === 0, `${label} : boutons principaux visibles ${off.length ? off.join(', ') : ''}`);
}

for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.name} ===`);
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    hasTouch: vp.mobile,
    isMobile: vp.mobile,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${OUT}/${vp.name}-${n}.png` });

  await page.goto(URL);
  await page.waitForTimeout(400);
  await shot('01-menu');
  await noOverflow(page, 'Menu');
  await page.click('[data-testid=btn-new]');
  await page.fill('[data-testid=input-name]', 'Épicerie Test');
  await page.click('[data-testid=btn-start-game]');
  await page.waitForTimeout(600);
  await shot('02-start');
  await noOverflow(page, 'Jeu (début)');
  await buttonsInViewport(page, 'Jeu (début)');

  // Aménagement : étagère + frigo + corbeille
  await page.click('[data-testid=btn-build]');
  for (const id of ['etagere', 'frigo', 'etagere', 'panier_pain']) {
    await page.click(`[data-testid=pal-${id}]`);
    await page.waitForTimeout(150);
    const ok = await page.locator('[data-testid=btn-confirm-place]').isEnabled();
    if (ok) await page.click('[data-testid=btn-confirm-place]');
    else await page.locator('.build-actions .btn').first().click();
    await page.waitForTimeout(150);
  }
  await shot('03-build');
  await noOverflow(page, 'Aménagement');
  const shelves = await page.evaluate(() => window.__commerce.engine.state.furniture.length);
  check(shelves >= 3, `Placement des rayons (${shelves} meubles)`);

  // Test de déplacement tactile : sélectionner puis déplacer un meuble
  const moved = await page.evaluate(() => {
    const c = window.__commerce;
    const f = c.engine.state.furniture[0];
    c.startMove(f.uid);
    c.moveGhostTo(f.x, f.y + 2);
    const valid = c.build.ghost.valid;
    c.confirmGhost();
    return { valid, y: c.engine.state.furniture[0].y };
  });
  check(moved.valid, 'Déplacement d’un meuble validé par la grille');
  await page.click('[data-testid=btn-build-done]');

  // Commande
  await page.click('[data-testid=nav-computer]');
  await page.waitForTimeout(200);
  await shot('04-computer');
  await noOverflow(page, 'Ordinateur');
  await page.click('[data-testid=sup-grossiste]');
  await page.click('[data-testid=btn-suggest]');
  await page.waitForTimeout(200);
  await shot('05-order');
  await page.click('[data-testid=btn-order]');
  await page.waitForTimeout(200);
  const orders = await page.evaluate(() => window.__commerce.engine.state.orders.length);
  check(orders === 1, 'Commande passée');

  // Journée
  await page.click('[data-testid=nav-store]');
  await page.click('[data-testid=btn-start]');
  await page.click('[aria-label="Vitesse x4"]');
  await page.waitForFunction(() => window.__commerce.engine.state.orders.some((o) => o.status === 'arrived'), null, { timeout: 20000 });
  await page.waitForTimeout(1300);
  await shot('06-truck');
  await page.click('[data-testid=btn-pickup]');
  await page.waitForFunction(() => window.__commerce.engine.state.orders.some((o) => o.status === 'received'), null, { timeout: 15000 });
  const onShelf = await page.evaluate(() => window.__commerce.engine.state.furniture.reduce((a, f) => a + f.slots.reduce((b, s) => b + s.qty, 0), 0));
  check(onShelf > 0, `Réception : ${onShelf} articles en rayon`);
  await shot('07-received');

  // Laisser tourner avec des clients
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    await dismiss(page);
  }
  await shot('08-customers');
  const sold = await page.evaluate(() => window.__commerce.engine.state.today.itemsSold);
  const visible = await page.evaluate(() => window.__commerce.engine.customers.length);
  check(sold > 0, `Ventes en cours (${sold} articles, ${visible} clients visibles)`);

  // Panneaux
  for (const tab of ['stock', 'finances', 'manage', 'computer']) {
    await page.click(`[data-testid=nav-${tab}]`);
    await page.waitForTimeout(250);
    await dismiss(page);
    await shot(`09-${tab}`);
    await noOverflow(page, `Panneau ${tab}`);
    await buttonSizes(page, `Panneau ${tab}`);
  }
  // Fiche produit (feuille défilante)
  await page.click('[data-testid=nav-stock]');
  await page.locator('.row-card').first().click();
  await page.waitForTimeout(200);
  await shot('10-product');
  const sheetScroll = await page.evaluate(() => {
    const el = document.querySelector('.sheet-body');
    return el ? getComputedStyle(el).overflowY : 'none';
  });
  check(sheetScroll === 'auto', 'Feuille produit défilable');
  await page.locator('.sheet .icon-btn').click();

  // Marketing
  await page.evaluate(() => {
    const c = window.__commerce;
    c.computerTab = 'marketing';
    c.bump();
  });
  await page.click('[data-testid=nav-computer]');
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__commerce.engine.state.campaigns.length);
  await page.locator('.camp-card .btn.primary').first().click();
  const after = await page.evaluate(() => window.__commerce.engine.state.campaigns.length);
  check(after === before + 1, 'Campagne marketing lancée');
  await shot('11-marketing');

  // Fin de journée
  await page.click('[data-testid=nav-store]');
  await page.evaluate(() => {
    const e = window.__commerce.engine;
    while (e.state.phase === 'running' || e.state.phase === 'closing') e.tick(30);
  });
  await page.waitForTimeout(400);
  await dismiss(page);
  await shot('12-report');
  const phase = await page.evaluate(() => window.__commerce.engine.state.phase);
  check(phase === 'report', 'Bilan de fin de journée affiché');
  await noOverflow(page, 'Bilan');
  await page.click('[data-testid=btn-next-day]');
  await page.waitForTimeout(300);
  await dismiss(page);
  const day = await page.evaluate(() => window.__commerce.engine.state.day);
  check(day === 2, 'Passage au jour 2');

  // Sauvegarde + rechargement
  const cashBefore = await page.evaluate(() => {
    window.__commerce.save();
    return window.__commerce.engine.state.cash;
  });
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('[data-testid=btn-continue]');
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => ({ day: window.__commerce.engine.state.day, cash: window.__commerce.engine.state.cash, f: window.__commerce.engine.state.furniture.length }));
  check(restored.day === 2 && restored.cash === cashBefore && restored.f === shelves, `Sauvegarde/rechargement (jour ${restored.day}, ${restored.f} meubles)`);

  // Agrandissement (argent de test injecté) + progression
  await page.evaluate(() => {
    const e = window.__commerce.engine;
    e.state.cash += 10000000;
    e.state.xp = 20000;
    e.addMarginXp(100);
    window.__commerce.levelUps = [];
    e.expandStore();
    e.expandStore();
    window.__commerce.bump();
  });
  await page.waitForTimeout(600);
  await dismiss(page);
  await shot('13-expanded');
  const lvl = await page.evaluate(() => window.__commerce.engine.state.storeLevel);
  check(lvl === 3, `Agrandissement du magasin (niveau ${lvl})`);
  await noOverflow(page, 'Magasin agrandi');

  check(errors.length === 0, `Aucune erreur console ${errors.length ? errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}

server.kill();
console.log(`\n${failures.length ? '❌ ' + failures.length + ' échec(s)' : '✅ Tous les tests visuels sont passés'}`);
process.exit(failures.length ? 1 : 0);
