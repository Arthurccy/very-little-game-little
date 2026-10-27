import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import type { PublicAnswer } from '@fps/shared';
import { Burst } from './Burst';

/**
 * `eliminated` : abattue par le joueur (explosion) ; `dismissed` : mauvaise réponse restée debout
 * quand la question est ratée (elle s'enfonce dans le sol, sans éclats).
 */
export type TargetState = 'alive' | 'eliminated' | 'dismissed' | 'correct' | 'correct-hit';

interface Props {
  answer: PublicAnswer;
  index: number;
  x: number;
  /** Profondeur actuelle, recalculée à chaque image depuis le temps restant. */
  getZ: () => number;
  /** Part du chrono écoulée (0 → 1), pour l'attitude menaçante en fin de temps. */
  getProgress: () => number;
  state: TargetState;
  accent: string;
  /** Horodatage local du dernier impact sur cette cible (effet de recul). */
  hitAt: number | null;
  boss: boolean;
  /** Enregistre le groupe pour que la couche d'étiquettes HTML puisse le suivre. */
  register: (answerId: string, group: Group | null) => void;
}

/** Au-delà de cette part du chrono, les ennemis deviennent menaçants. */
const THREAT_START = 0.65;
/** Durée de l'implosion du corps à la mort, en ms. */
const DEATH_MS = 180;
const RED = new Color('#ff2d2d');
const WHITE = new Color('#ffffff');

/**
 * Un ennemi porteur d'une réponse. Le raycast du joueur remonte jusqu'au groupe
 * via `userData.answerId` ; `userData.alive` exclut les cibles déjà abattues.
 */
export function Target({ answer, index, x, getZ, getProgress, state, accent, hitAt, boss, register }: Props) {
  const group = useRef<Group>(null);
  const bodyGroup = useRef<Group>(null);
  const body = useRef<MeshStandardMaterial>(null);
  const eyes = useRef<(MeshBasicMaterial | null)[]>([]);
  const [deathAt, setDeathAt] = useState<number | null>(null);
  const [hitBurstAt, setHitBurstAt] = useState<number | null>(null);
  const dismissedAt = useRef<number | null>(null);
  const baseEmissive = useRef(new Color());

  useEffect(() => {
    register(answer.id, group.current);
    return () => register(answer.id, null);
  }, [answer.id, register]);

  useEffect(() => {
    setDeathAt(state === 'eliminated' ? performance.now() : null);
    if (state === 'correct-hit') setHitBurstAt(performance.now());
    dismissedAt.current = state === 'dismissed' ? performance.now() : null;
  }, [state]);

  const color = state === 'correct' ? '#22c55e' : state === 'correct-hit' ? '#ef4444' : accent;
  baseEmissive.current.set(color);

  useFrame(() => {
    const g = group.current;
    const b = bodyGroup.current;
    if (!g || !b) return;
    const t = performance.now();
    g.position.z = getZ();

    const alive = state === 'alive';
    // Montée rapide (racine carrée) pour que la menace se voie dès qu'elle commence.
    const threat = alive ? Math.sqrt(Math.min(1, Math.max(0, (getProgress() - THREAT_START) / (1 - THREAT_START)))) : 0;

    // Flottement, plus nerveux quand le temps presse ; tremblement et penchée vers le joueur.
    g.position.y = alive ? Math.sin(t / (400 - 250 * threat) + index) * (0.08 + 0.06 * threat) : 0;
    if (dismissedAt.current !== null) g.position.y = -2.4 * Math.min(1, (t - dismissedAt.current) / 600);
    g.position.x = x + Math.sin(t / 23 + index * 7) * 0.06 * threat;
    b.rotation.x = 0.3 * threat;

    // Mort : petit gonflement puis implosion, pendant que les éclats partent.
    let scale = 1;
    if (deathAt !== null) {
      const k = (t - deathAt) / DEATH_MS;
      scale = k < 0.3 ? 1 + k : Math.max(0, 1.3 * (1 - (k - 0.3) / 0.7));
    } else if (hitAt !== null && t - hitAt < 220) {
      scale = 1 + 0.15 * (1 - (t - hitAt) / 220);
    }
    b.scale.setScalar(scale);
    b.visible = scale > 0.001;

    if (body.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 90);
      body.current.color.copy(baseEmissive.current).lerp(RED, threat * 0.7);
      body.current.emissive.copy(baseEmissive.current).lerp(RED, threat * (0.6 + 0.4 * pulse));
      body.current.emissiveIntensity =
        state === 'correct' || state === 'correct-hit'
          ? 0.9 + Math.sin(t / 120) * 0.3
          : alive
            ? 0.25 + 0.6 * threat * pulse
            : 0;
    }
    for (const eye of eyes.current) eye?.color.copy(WHITE).lerp(RED, threat);
  });

  const bodyScale = boss ? 0.9 : 1;

  return (
    <group ref={group} position={[x, 0, getZ()]} userData={{ answerId: answer.id, alive: state === 'alive' }}>
      <group ref={bodyGroup} position={[0, 0, 0]}>
        <group scale={bodyScale}>
          <mesh position={[0, 1.1, 0]}>
            <capsuleGeometry args={[0.45, 1, 6, 12]} />
            <meshStandardMaterial ref={body} color={color} emissive={color} emissiveIntensity={0.25} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
          {[-0.12, 0.12].map((dx, i) => (
            <mesh key={dx} position={[dx, 2.1, 0.28]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial
                ref={(m) => {
                  eyes.current[i] = m;
                }}
                color="#fff"
              />
            </mesh>
          ))}
        </group>
      </group>
      <Burst trigger={deathAt} color={accent} position={[0, 1.3, 0]} count={24} speed={6} size={0.28} duration={0.8} />
      <Burst trigger={hitBurstAt} color="#ef4444" position={[0, 1.3, 0]} count={16} speed={4} size={0.2} />
    </group>
  );
}
