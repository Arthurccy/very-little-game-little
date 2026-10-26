import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, MeshStandardMaterial } from 'three';
import type { PublicAnswer } from '@fps/shared';

export type TargetState = 'alive' | 'eliminated' | 'correct' | 'correct-hit';

interface Props {
  answer: PublicAnswer;
  index: number;
  x: number;
  /** Profondeur actuelle, recalculée à chaque image depuis le temps restant. */
  getZ: () => number;
  state: TargetState;
  accent: string;
  /** Horodatage local du dernier impact sur cette cible (effet de recul). */
  hitAt: number | null;
  boss: boolean;
  /** Enregistre le groupe pour que la couche d'étiquettes HTML puisse le suivre. */
  register: (answerId: string, group: Group | null) => void;
}

/**
 * Un ennemi porteur d'une réponse. Le raycast du joueur remonte jusqu'au groupe
 * via `userData.answerId` ; `userData.alive` exclut les cibles déjà abattues.
 */
export function Target({ answer, index, x, getZ, state, accent, hitAt, boss, register }: Props) {
  const group = useRef<Group>(null);
  const body = useRef<MeshStandardMaterial>(null);
  const fallStart = useRef<number | null>(null);

  useEffect(() => {
    register(answer.id, group.current);
    return () => register(answer.id, null);
  }, [answer.id, register]);

  useEffect(() => {
    fallStart.current = state === 'eliminated' ? performance.now() : null;
  }, [state]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now();
    g.position.z = getZ();
    // Léger flottement pour rendre les cibles vivantes.
    g.position.y = state === 'alive' ? Math.sin(t / 400 + index) * 0.08 : g.position.y;

    if (fallStart.current !== null) {
      const k = Math.min(1, (t - fallStart.current) / 450);
      g.rotation.x = -k * (Math.PI / 2);
      g.position.y = -k * 0.4;
    } else {
      g.rotation.x = 0;
    }

    if (hitAt !== null && t - hitAt < 220) {
      const k = 1 - (t - hitAt) / 220;
      g.scale.setScalar(1 + 0.15 * k);
    } else {
      g.scale.setScalar(1);
    }

    if (body.current) {
      body.current.emissiveIntensity =
        state === 'correct' || state === 'correct-hit' ? 0.9 + Math.sin(t / 120) * 0.3 : state === 'alive' ? 0.25 : 0;
    }
  });

  const color =
    state === 'correct' ? '#22c55e' : state === 'correct-hit' ? '#ef4444' : state === 'eliminated' ? '#4b5563' : accent;
  const scale = boss ? 0.9 : 1;

  return (
    <group ref={group} position={[x, 0, getZ()]} userData={{ answerId: answer.id, alive: state === 'alive' }}>
      <group scale={scale}>
        <mesh position={[0, 1.1, 0]}>
          <capsuleGeometry args={[0.45, 1, 6, 12]} />
          <meshStandardMaterial ref={body} color={color} emissive={color} emissiveIntensity={0.25} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
        {[-0.12, 0.12].map((dx) => (
          <mesh key={dx} position={[dx, 2.1, 0.28]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={state === 'alive' ? '#fff' : '#111'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
