// Petits sons synthétisés via Web Audio (aucun fichier externe).

type SoundName = 'door' | 'buy' | 'ok' | 'truck' | 'unlock' | 'error' | 'coin' | 'build';

class AudioManager {
  private ctx: AudioContext | null = null;
  enabled = true;
  private last: Record<string, number> = {};

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx!.state === 'suspended') void this.ctx!.resume();
    return this.ctx;
  }

  /** À appeler lors d'une interaction utilisateur (déverrouillage iOS). */
  unlock(): void {
    this.ensure();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(name: SoundName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    const minGap = name === 'buy' || name === 'coin' ? 120 : 60;
    if (now - (this.last[name] ?? 0) < minGap) return;
    this.last[name] = now;
    switch (name) {
      case 'door':
        this.tone(880, 0, 0.18, 'sine', 0.05);
        this.tone(660, 0.12, 0.25, 'sine', 0.05);
        break;
      case 'buy':
        this.tone(1320, 0, 0.06, 'square', 0.02);
        break;
      case 'coin':
        this.tone(988, 0, 0.08, 'square', 0.035);
        this.tone(1319, 0.07, 0.18, 'square', 0.035);
        break;
      case 'ok':
        this.tone(523, 0, 0.1, 'triangle', 0.07);
        this.tone(784, 0.08, 0.15, 'triangle', 0.07);
        break;
      case 'truck':
        this.tone(196, 0, 0.25, 'sawtooth', 0.04);
        this.tone(247, 0.3, 0.3, 'sawtooth', 0.04);
        break;
      case 'unlock':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.22, 'triangle', 0.07));
        break;
      case 'error':
        this.tone(220, 0, 0.2, 'square', 0.04, 150);
        break;
      case 'build':
        this.tone(330, 0, 0.08, 'square', 0.04);
        this.tone(440, 0.06, 0.1, 'square', 0.04);
        break;
    }
  }
}

export const audio = new AudioManager();
