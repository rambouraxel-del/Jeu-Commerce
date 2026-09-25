import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const file = process.argv[2]; const tag = process.argv[3];
const save = readFileSync(file, 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const vp of [{w:390,h:844,m:true},{w:1280,h:800,m:false}]) {
const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m?2:1, hasTouch: vp.m, isMobile: vp.m });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4180/');
await page.evaluate((s) => localStorage.setItem('commerce-save-v1', s), save);
await page.reload();
await page.click('[data-testid=btn-continue]');
await page.waitForTimeout(500);
await page.click('[data-testid=btn-start]').catch(()=>{});
await page.click('[aria-label="Vitesse x4"]').catch(()=>{});
await page.waitForTimeout(6000);
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
const info = await page.evaluate(() => ({ cust: window.__commerce.engine.customers.length, today: window.__commerce.engine.state.today.customers }));
await page.screenshot({ path: `/tmp/claude-0/shots/demo-${tag}-${vp.w}.png` });
console.log(tag, vp.w, 'fps', fps, JSON.stringify(info), errors);
await ctx.close();
}
await browser.close();
