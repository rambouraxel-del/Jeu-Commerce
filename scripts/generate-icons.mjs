// Génère les icônes PNG de la PWA à partir de public/icons/icon.svg (via Chromium/Playwright).
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
for (const [size, file, pad] of [
  [192, 'icon-192.png', 0],
  [512, 'icon-512.png', 0],
  [512, 'icon-maskable-512.png', 60],
]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(
    `<html><body style="margin:0;background:#fff8ee;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false });
  console.log('✓', file);
}
await browser.close();
