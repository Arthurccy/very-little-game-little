/**
 * Musique d'ambiance générée en direct (Web Audio API) : une boucle par décor, plus intense
 * pour le boss. Un séquenceur à anticipation planifie les notes ~120 ms à l'avance pour un
 * tempo stable, indépendamment des images de la scène.
 */
import { audio, isMuted, onMuteChange } from './audio';

const MUSIC_KEY = 'fps-edu:music';
const VOLUME = 0.55;
const FADE_S = 0.8;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

type Drums = 'soft' | 'drive' | 'boss';

interface Track {
  bpm: number;
  /** Note MIDI de la tonique, à l'octave de la basse. */
  root: number;
  scale: number[];
  /** Degrés (0-based) des accords, un par mesure. */
  progression: number[];
  lead: OscillatorType;
  drums: Drums;
}

/** Une boucle par décor (Theme.scenery) et une pour le boss. */
const TRACKS: Record<string, Track> = {
  lobby: { bpm: 96, root: 38, scale: MINOR, progression: [0, 5, 2, 6], lead: 'triangle', drums: 'soft' },
  warehouse: { bpm: 104, root: 40, scale: DORIAN, progression: [0, 3, 0, 4], lead: 'square', drums: 'soft' },
  border: { bpm: 110, root: 43, scale: MINOR, progression: [0, 6, 5, 4], lead: 'triangle', drums: 'drive' },
  vault: { bpm: 92, root: 41, scale: HARMONIC_MINOR, progression: [0, 5, 3, 4], lead: 'sine', drums: 'soft' },
  lab: { bpm: 116, root: 45, scale: MINOR, progression: [0, 6, 5, 6], lead: 'square', drums: 'drive' },
  datacenter: { bpm: 124, root: 47, scale: MINOR, progression: [0, 2, 5, 4], lead: 'sawtooth', drums: 'drive' },
  boss: { bpm: 140, root: 36, scale: PHRYGIAN, progression: [0, 1, 0, 6], lead: 'sawtooth', drums: 'boss' },
};

interface Playing {
  key: string;
  track: Track;
  ctx: AudioContext;
  bus: GainNode;
  step: number;
  nextTime: number;
  timer: number;
}

let playing: Playing | null = null;
/** Piste demandée par le jeu, rejouée quand le son ou la musique sont réactivés. */
let wanted: string | null = null;
let enabled = readEnabled();
let noiseBuffer: AudioBuffer | null = null;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Note MIDI d'un degré de la gamme (les degrés au-delà de 7 montent d'octave). */
function degree(track: Track, d: number, octave = 0): number {
  const oct = Math.floor(d / track.scale.length);
  const idx = ((d % track.scale.length) + track.scale.length) % track.scale.length;
  return track.root + track.scale[idx]! + 12 * (oct + octave);
}

function voice(
  p: Playing,
  freq: number,
  t: number,
  duration: number,
  { type = 'sine' as OscillatorType, volume = 0.1, attack = 0.005, cutoff = 0 } = {},
): void {
  const osc = p.ctx.createOscillator();
  const gain = p.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  let node: AudioNode = osc;
  if (cutoff > 0) {
    const filter = p.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    node = osc.connect(filter);
  }
  node.connect(gain).connect(p.bus);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function kick(p: Playing, t: number, volume: number): void {
  const osc = p.ctx.createOscillator();
  const gain = p.ctx.createGain();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(p.bus);
  osc.start(t);
  osc.stop(t + 0.2);
}

function noiseHit(p: Playing, t: number, volume: number, duration: number, type: BiquadFilterType, freq: number) {
  if (!noiseBuffer) {
    const length = p.ctx.sampleRate;
    noiseBuffer = p.ctx.createBuffer(1, length, p.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = p.ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = p.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = p.ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(p.bus);
  src.start(t);
  src.stop(t + duration + 0.02);
}

/** Planifie une double-croche (16 par mesure). */
function playStep(p: Playing, step: number, t: number): void {
  const { track } = p;
  const s = step % 16;
  const bar = Math.floor(step / 16) % track.progression.length;
  const chord = track.progression[bar]!;
  const sixteenth = 60 / track.bpm / 4;
  const boss = track.drums === 'boss';

  // Nappe : l'accord tenu sur toute la mesure.
  if (s === 0) {
    for (const d of [0, 2, 4]) {
      voice(p, midiToFreq(degree(track, chord + d, 2)), t, sixteenth * 16, {
        type: 'triangle',
        volume: 0.035,
        attack: 0.25,
        cutoff: 1400,
      });
    }
  }

  // Basse.
  const bassSteps = boss ? [0, 2, 4, 6, 8, 10, 12, 14] : track.drums === 'drive' ? [0, 3, 8, 11] : [0, 8];
  if (bassSteps.includes(s)) {
    voice(p, midiToFreq(degree(track, chord)), t, sixteenth * (boss ? 1.6 : 3), {
      type: 'sawtooth',
      volume: boss ? 0.16 : 0.13,
      cutoff: boss ? 700 : 450,
    });
  }

  // Arpège : croches (doubles-croches pour le boss), à partir de la 2e mesure du cycle.
  const arpEvery = boss ? 1 : 2;
  if (s % arpEvery === 0 && (boss || bar > 0)) {
    const pattern = [0, 2, 4, 7, 4, 2];
    const d = chord + pattern[(step / arpEvery) % pattern.length]!;
    voice(p, midiToFreq(degree(track, d, 3)), t, sixteenth * 1.5, {
      type: track.lead,
      volume: boss ? 0.03 : 0.022,
      cutoff: 2600,
    });
  }

  // Batterie.
  const kicks = boss ? [0, 4, 8, 12] : track.drums === 'drive' ? [0, 8, 10] : [0, 8];
  if (kicks.includes(s)) kick(p, t, boss ? 0.5 : 0.35);
  if (s % 4 === 2) noiseHit(p, t, boss ? 0.06 : 0.035, 0.05, 'highpass', 7000);
  if ((boss || track.drums === 'drive') && (s === 4 || s === 12)) noiseHit(p, t, 0.12, 0.14, 'bandpass', 1800);
}

function schedule(): void {
  const p = playing;
  if (!p) return;
  const sixteenth = 60 / p.track.bpm / 4;
  // Rattrapage si l'onglet a été mis en arrière-plan : on repart de maintenant.
  if (p.nextTime < p.ctx.currentTime - 0.5) p.nextTime = p.ctx.currentTime + 0.05;
  while (p.nextTime < p.ctx.currentTime + LOOKAHEAD_S) {
    playStep(p, p.step, p.nextTime);
    p.nextTime += sixteenth;
    p.step++;
  }
}

function fadeOut(p: Playing): void {
  window.clearInterval(p.timer);
  const now = p.ctx.currentTime;
  p.bus.gain.cancelScheduledValues(now);
  p.bus.gain.setValueAtTime(p.bus.gain.value, now);
  p.bus.gain.linearRampToValueAtTime(0, now + FADE_S);
  window.setTimeout(() => p.bus.disconnect(), (FADE_S + 0.2) * 1000);
}

function start(key: string): void {
  const track = TRACKS[key] ?? TRACKS.lobby!;
  if (playing?.key === key) return;
  const out = audio();
  if (!out) return;
  if (playing) fadeOut(playing);
  const bus = out.ctx.createGain();
  bus.gain.setValueAtTime(0, out.ctx.currentTime);
  bus.gain.linearRampToValueAtTime(VOLUME, out.ctx.currentTime + FADE_S);
  bus.connect(out.out);
  playing = {
    key,
    track,
    ctx: out.ctx,
    bus,
    step: 0,
    nextTime: out.ctx.currentTime + 0.1,
    timer: window.setInterval(schedule, TICK_MS),
  };
  schedule();
}

export const music = {
  /** Joue la boucle d'un décor (ou « boss ») ; changer de piste fait un fondu enchaîné. */
  play(key: string): void {
    wanted = key;
    if (enabled && !isMuted()) start(key);
  },
  /** Arrête la musique en fondu. */
  stop(): void {
    wanted = null;
    if (playing) fadeOut(playing);
    playing = null;
  },
  isEnabled: () => enabled,
  setEnabled(value: boolean): void {
    enabled = value;
    try {
      localStorage.setItem(MUSIC_KEY, value ? '1' : '0');
    } catch {
      // stockage indisponible : le réglage ne survivra pas au rechargement
    }
    if (!value && playing) {
      fadeOut(playing);
      playing = null;
    } else if (value && wanted && !isMuted()) {
      start(wanted);
    }
  },
};

// Couper le son (touche M) coupe aussi la musique ; le rétablir la relance.
onMuteChange((muted) => {
  if (muted && playing) {
    fadeOut(playing);
    playing = null;
  } else if (!muted && enabled && wanted) {
    start(wanted);
  }
});
