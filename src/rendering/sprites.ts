// Dessin procédural des personnages et objets (unités = cases).

import type { Customer } from '../game/types';

export const SKIN_TONES = ['#f5d0b0', '#e0ac85', '#c68a5e', '#8d5a3b'];
const HAIR = ['#2b1d14', '#6b4226', '#d9b26f', '#a33b20', '#cfcfcf'];

interface SkinDef {
  shirts: string[];
  pants: string;
  hair: number; // style
  hairColors: number[];
}

// 8 skins distincts (un par profil de client)
export const SKINS: SkinDef[] = [
  { shirts: ['#6c63ff', '#3aafa9', '#ef6f6c', '#5c946e'], pants: '#39424e', hair: 1, hairColors: [0, 1, 3] }, // étudiant : sweat + sac à dos
  { shirts: ['#f4a259', '#5b8e7d', '#bc4b51', '#8cb369'], pants: '#3d405b', hair: 2, hairColors: [0, 1, 2] }, // famille : panier
  { shirts: ['#a3a380', '#b5838d', '#6d6875', '#84a59d'], pants: '#5e548e', hair: 3, hairColors: [4, 4, 4] }, // retraité : cheveux gris, lunettes
  { shirts: ['#2b2d42', '#34495e', '#1d3557', '#3c3c3c'], pants: '#22223b', hair: 0, hairColors: [0, 1, 2] }, // cadre : costume, mallette
  { shirts: ['#ff006e', '#fb5607', '#8338ec', '#3a86ff'], pants: '#264653', hair: 4, hairColors: [0, 2, 3] }, // ado : casquette, casque
  { shirts: ['#06d6a0', '#ffd166', '#ef476f', '#118ab2'], pants: '#073b4c', hair: 5, hairColors: [0, 1, 3] }, // sportif : bandeau
  { shirts: ['#e9c46a', '#f28482', '#84a98c', '#cdb4db'], pants: '#6b705c', hair: 6, hairColors: [0, 1, 3] }, // chasseur de promos : cabas
  { shirts: ['#7f5539', '#b08968', '#582f0e', '#9c6644'], pants: '#1b1b1b', hair: 7, hairColors: [0, 2, 3] }, // aisé : manteau, lunettes de soleil
];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export const roundRect = rr;

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Dessine un personnage. (x, y) = position des pieds. */
export function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: {
    skin: number;
    variant: number;
    facing: number;
    walk: number;
    moving: boolean;
    items: number;
    isPlayer?: boolean;
    playerColor?: string;
    carrying?: boolean;
  },
): void {
  const def = SKINS[opts.skin % SKINS.length];
  const v = opts.variant;
  const shirt = opts.isPlayer ? opts.playerColor ?? '#e4572e' : def.shirts[v % def.shirts.length];
  const skinTone = SKIN_TONES[(v + opts.skin) % SKIN_TONES.length];
  const hairColor = HAIR[def.hairColors[v % def.hairColors.length]];
  const bob = opts.moving ? Math.abs(Math.sin(opts.walk)) * 0.03 : 0;
  const leg = opts.moving ? Math.sin(opts.walk) * 0.07 : 0;
  const f = opts.facing >= 0 ? 1 : -1;
  const s = opts.skin === 4 || opts.skin === 0 ? 0.92 : 1; // les jeunes sont un peu plus petits

  drawShadow(ctx, x, y, 0.2, 0.08);
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(s, s);

  // jambes
  ctx.fillStyle = def.pants;
  ctx.fillRect(-0.09 + leg * 0.3, -0.24, 0.07, 0.24);
  ctx.fillRect(0.02 - leg * 0.3, -0.24, 0.07, 0.24);
  ctx.fillStyle = '#222';
  ctx.fillRect(-0.1 + leg * 0.3, -0.03, 0.09, 0.04);
  ctx.fillRect(0.01 - leg * 0.3, -0.03, 0.09, 0.04);

  // accessoire dos : sac à dos (étudiant)
  if (opts.skin === 0 && !opts.isPlayer) {
    ctx.fillStyle = '#e76f51';
    rr(ctx, -0.16 * f - 0.06, -0.56, 0.12, 0.24, 0.04);
    ctx.fill();
  }

  // corps
  ctx.fillStyle = shirt;
  const longCoat = opts.skin === 7;
  rr(ctx, -0.14, -0.6, 0.28, longCoat ? 0.44 : 0.38, 0.08);
  ctx.fill();
  if (opts.skin === 3) {
    // chemise + cravate
    ctx.fillStyle = '#f1f1f1';
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.6);
    ctx.lineTo(0.05, -0.6);
    ctx.lineTo(0, -0.48);
    ctx.fill();
    ctx.fillStyle = '#c1121f';
    ctx.fillRect(-0.012, -0.56, 0.024, 0.12);
  }
  if (opts.isPlayer) {
    // tablier
    ctx.fillStyle = '#ffffff';
    rr(ctx, -0.1, -0.5, 0.2, 0.28, 0.04);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.fillRect(-0.03, -0.44, 0.06, 0.05);
  }
  if (opts.skin === 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(-0.14, -0.46, 0.28, 0.03);
  }

  // bras
  ctx.fillStyle = skinTone;
  const arm = opts.moving ? Math.sin(opts.walk + Math.PI) * 0.04 : 0;
  ctx.fillRect(-0.19, -0.55 + arm, 0.055, 0.22);
  ctx.fillRect(0.135, -0.55 - arm, 0.055, 0.22);

  // objets tenus
  if (opts.carrying) {
    ctx.fillStyle = '#c69c6d';
    rr(ctx, -0.2, -0.72, 0.4, 0.28, 0.02);
    ctx.fill();
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.6);
    ctx.lineTo(0.2, -0.6);
    ctx.stroke();
  } else if (opts.skin === 3) {
    ctx.fillStyle = '#5a3825';
    rr(ctx, 0.13 * f - 0.05, -0.36, 0.12, 0.1, 0.02);
    ctx.fill();
  } else if (opts.skin === 6) {
    ctx.fillStyle = '#e63946';
    rr(ctx, 0.16 * f - 0.07, -0.42, 0.14, 0.18, 0.03);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 0.1px sans-serif';
  } else if (opts.skin === 7) {
    ctx.fillStyle = '#d4a373';
    rr(ctx, 0.15 * f - 0.05, -0.4, 0.11, 0.1, 0.03);
    ctx.fill();
  } else if (opts.skin === 5) {
    ctx.fillStyle = '#48cae4';
    ctx.fillRect(0.16 * f - 0.025, -0.44, 0.05, 0.12);
  }
  if (opts.items > 0 && !opts.carrying) {
    // panier
    ctx.fillStyle = '#d62828';
    ctx.fillRect(-0.24 * f - 0.08, -0.38, 0.16, 0.1);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-0.24 * f - 0.06, -0.42, 0.05, 0.05);
    if (opts.items > 1) {
      ctx.fillStyle = '#8ecae6';
      ctx.fillRect(-0.24 * f + 0.0, -0.43, 0.05, 0.06);
    }
  }

  // tête
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(0, -0.74, 0.14, 0, Math.PI * 2);
  ctx.fill();
  // yeux
  ctx.fillStyle = '#222';
  ctx.fillRect(0.02 * f + 0.03, -0.76, 0.025, 0.03);
  ctx.fillRect(0.02 * f - 0.05, -0.76, 0.025, 0.03);

  // cheveux / couvre-chef
  ctx.fillStyle = hairColor;
  const style = opts.isPlayer ? -1 : def.hair;
  switch (style) {
    case -1: // casquette du gérant
      ctx.fillStyle = opts.playerColor ?? '#e4572e';
      ctx.beginPath();
      ctx.arc(0, -0.78, 0.145, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(0.02 * f - 0.02 + 0.06 * f, -0.8, 0.14 * f, 0.035);
      break;
    case 0: // coupe courte nette
      ctx.beginPath();
      ctx.arc(0, -0.78, 0.14, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      break;
    case 1: // mèches désordonnées
      ctx.beginPath();
      ctx.arc(0, -0.79, 0.145, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-0.09, -0.86, 0.05, 0, Math.PI * 2);
      ctx.arc(0.06, -0.89, 0.055, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 2: // mi-longs
      ctx.beginPath();
      ctx.arc(0, -0.78, 0.15, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-0.15, -0.78, 0.05, 0.14);
      ctx.fillRect(0.1, -0.78, 0.05, 0.14);
      break;
    case 3: // gris + lunettes
      ctx.beginPath();
      ctx.arc(0, -0.8, 0.13, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.015;
      ctx.strokeRect(-0.08, -0.78, 0.065, 0.045);
      ctx.strokeRect(0.015, -0.78, 0.065, 0.045);
      break;
    case 4: // casquette + casque audio
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(0, -0.79, 0.145, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-0.02 - 0.12 * f, -0.8, 0.14 * -f, 0.035);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.arc(0, -0.74, 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.fillRect(-0.18, -0.77, 0.05, 0.08);
      ctx.fillRect(0.13, -0.77, 0.05, 0.08);
      break;
    case 5: // bandeau sportif
      ctx.beginPath();
      ctx.arc(0, -0.79, 0.14, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#ef233c';
      ctx.fillRect(-0.145, -0.83, 0.29, 0.04);
      break;
    case 6: // chapeau de paille
      ctx.fillStyle = '#e9c46a';
      ctx.beginPath();
      ctx.ellipse(0, -0.84, 0.21, 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -0.85, 0.1, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-0.1, -0.87, 0.2, 0.025);
      break;
    case 7: // chignon + lunettes de soleil
      ctx.beginPath();
      ctx.arc(0, -0.79, 0.145, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -0.93, 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      rr(ctx, -0.1, -0.79, 0.2, 0.05, 0.02);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export function customerItems(c: Customer): number {
  return c.items.reduce((a, it) => a + it.qty, 0);
}
