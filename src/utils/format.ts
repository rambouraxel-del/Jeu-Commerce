export function euros(cents: number, decimals: 'auto' | 0 | 2 = 'auto'): string {
  const v = cents / 100;
  const d = decimals === 'auto' ? (Math.abs(v) >= 1000 ? 0 : 2) : decimals;
  return (
    v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ') +
    ' €'
  );
}

export function compactEuros(cents: number): string {
  const v = cents / 100;
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2).replace('.', ',') + ' M€';
  if (a >= 10_000) return Math.round(v / 1000) + ' k€';
  if (a >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + ' k€';
  return euros(cents, a >= 100 ? 0 : 2);
}

export function pct(v: number, decimals = 0): string {
  return (v * 100).toFixed(decimals).replace('.', ',') + ' %';
}

export function clock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function trend(current: number, previous: number | undefined): '↑' | '↓' | '→' {
  if (previous === undefined) return '→';
  const diff = current - previous;
  const ref = Math.max(1, Math.abs(previous));
  if (diff / ref > 0.03) return '↑';
  if (diff / ref < -0.03) return '↓';
  return '→';
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
