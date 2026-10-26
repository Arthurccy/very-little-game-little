/** Palette et accessoires de chaque décor (Theme.scenery), plus celui du boss. */
export interface Scenery {
  background: string;
  fog: string;
  floor: string;
  wall: string;
  accent: string;
  light: string;
  prop: 'pillar' | 'crate' | 'barrier' | 'vault' | 'tube' | 'rack' | 'spike';
}

export const SCENERIES: Record<string, Scenery> = {
  lobby: {
    background: '#1b2333',
    fog: '#1b2333',
    floor: '#3b4252',
    wall: '#2e3440',
    accent: '#88c0d0',
    light: '#e5f2ff',
    prop: 'pillar',
  },
  warehouse: {
    background: '#2b2118',
    fog: '#2b2118',
    floor: '#5c4a32',
    wall: '#3d3021',
    accent: '#e0a458',
    light: '#ffe2b8',
    prop: 'crate',
  },
  border: {
    background: '#0f2027',
    fog: '#0f2027',
    floor: '#2c5364',
    wall: '#203a43',
    accent: '#f4d35e',
    light: '#fff6d5',
    prop: 'barrier',
  },
  vault: {
    background: '#141414',
    fog: '#141414',
    floor: '#3a3a3a',
    wall: '#262626',
    accent: '#d4af37',
    light: '#fff1c1',
    prop: 'vault',
  },
  lab: {
    background: '#0b1d16',
    fog: '#0b1d16',
    floor: '#1f4d3a',
    wall: '#14342a',
    accent: '#6ee7b7',
    light: '#d1fae5',
    prop: 'tube',
  },
  datacenter: {
    background: '#05070f',
    fog: '#05070f',
    floor: '#111827',
    wall: '#0b1220',
    accent: '#60a5fa',
    light: '#dbeafe',
    prop: 'rack',
  },
  boss: {
    background: '#1a0505',
    fog: '#1a0505',
    floor: '#2b0b0b',
    wall: '#1f0707',
    accent: '#ef4444',
    light: '#ffd4d4',
    prop: 'spike',
  },
};

export const sceneryFor = (key: string | undefined) => SCENERIES[key ?? ''] ?? SCENERIES.lobby!;

/** Limites de l'arène et trajectoire des cibles (le joueur regarde vers -z). */
export const ARENA = {
  halfWidth: 14,
  depth: 40,
  playerStart: [0, 1.6, 8] as const,
  playerBounds: { minX: -9, maxX: 9, minZ: 3, maxZ: 11 },
  /** Les cibles avancent de zFar vers zNear à mesure que le chrono s'écoule. */
  zFar: -9,
  zNear: 1.5,
};
