/**
 * Effets sonores synthétisés avec la Web Audio API : aucun fichier à charger.
 * L'AudioContext n'est créé qu'au premier son, après un geste de l'utilisateur.
 */
const MUTE_KEY = 'fps-edu:muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // stockage indisponible : le réglage ne survivra pas au rechargement
  }
}

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  duration: number;
  volume?: number;
  delay?: number;
}

function tone({ type = 'sine', from, to = from, duration, volume = 0.6, delay = 0 }: ToneOptions): void {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + delay;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, volume = 0.5, filterFreq = 1800): void {
  const a = audio();
  if (!a) return;
  const length = Math.floor(a.ctx.sampleRate * duration);
  const buffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = a.ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.out);
  src.start();
}

export const sfx = {
  shoot: () => {
    noise(0.12, 0.5, 2500);
    tone({ type: 'square', from: 420, to: 90, duration: 0.1, volume: 0.25 });
  },
  eliminate: () => tone({ type: 'triangle', from: 520, to: 880, duration: 0.15, volume: 0.5 }),
  cleared: () => {
    tone({ type: 'triangle', from: 523, duration: 0.12, volume: 0.45 });
    tone({ type: 'triangle', from: 659, duration: 0.12, volume: 0.45, delay: 0.1 });
    tone({ type: 'triangle', from: 784, duration: 0.25, volume: 0.45, delay: 0.2 });
  },
  hitCorrect: () => {
    tone({ type: 'sawtooth', from: 220, to: 60, duration: 0.45, volume: 0.5 });
    noise(0.3, 0.4, 600);
  },
  timeout: () => {
    tone({ type: 'square', from: 330, duration: 0.18, volume: 0.3 });
    tone({ type: 'square', from: 220, duration: 0.35, volume: 0.3, delay: 0.2 });
  },
  bonus: () => {
    for (let i = 0; i < 4; i++)
      tone({ type: 'sine', from: 660 + i * 220, duration: 0.09, volume: 0.35, delay: i * 0.06 });
  },
  tick: () => tone({ type: 'sine', from: 1000, duration: 0.05, volume: 0.2 }),
  bossEnter: () => {
    tone({ type: 'sawtooth', from: 55, to: 40, duration: 1.4, volume: 0.6 });
    tone({ type: 'sawtooth', from: 82, to: 60, duration: 1.4, volume: 0.4, delay: 0.1 });
  },
  victory: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: 'triangle', from: f, duration: 0.3, volume: 0.45, delay: i * 0.15 }),
    );
  },
  defeat: () => {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ type: 'sawtooth', from: f, duration: 0.35, volume: 0.35, delay: i * 0.2 }),
    );
  },
  denied: () => tone({ type: 'square', from: 140, duration: 0.08, volume: 0.2 }),
};
