import { memo, useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { BOSS_ZONE, type PublicQuestion } from '@fps/shared';
import type { RevealState, ShotFx } from '../useGame';
import { Boss } from './Boss';
import { Environment } from './Environment';
import { LabelProjector } from './Labels';
import { Player, type AimShot } from './Player';
import { ARENA, sceneryFor } from './sceneries';
import { Target, type TargetState } from './Target';

interface Props {
  /** Question affichée : la question close pendant l'explication, sinon la question en cours. */
  question: PublicQuestion | null;
  reveal: RevealState | null;
  serverNow: () => number;
  lastShot: ShotFx | null;
  scenery: string | undefined;
  bossHealth: number;
  onShoot: (answerId: string | null) => void;
  onLockChange: (locked: boolean) => void;
  aimShot: AimShot | null;
}

/** Position latérale des cibles, réparties en éventail. */
function spreadX(index: number, count: number): number {
  const width = Math.min(18, 5 * (count - 1));
  return count === 1 ? 0 : -width / 2 + (width * index) / (count - 1);
}

/** Résolution de rendu (devicePixelRatio) : plafonnée, et abaissée si les FPS chutent. */
const DPR_MAX = 1.5;
const DPR_MIN = 0.75;

/**
 * Scène 3D. Mémoïsée : elle ne se re-rend que quand la question, l'explication ou un tir
 * changent, pas à chaque tic du chrono (le mouvement des cibles est calculé dans useFrame).
 */
export const World = memo(function World({
  question: shown,
  reveal,
  serverNow,
  lastShot,
  scenery,
  bossHealth,
  onShoot,
  onLockChange,
  aimShot,
}: Props) {
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, DPR_MAX));
  const isBoss = shown?.zone === BOSS_ZONE;
  const palette = sceneryFor(isBoss ? 'boss' : scenery);

  // L'avancée des ennemis reflète le temps restant ; elle n'inflige aucun dégât.
  // Pendant l'explication, les cibles restent figées là où elles étaient à la clôture.
  const getZ = () => {
    if (!shown) return ARENA.zFar;
    const start = Date.parse(shown.startedAt);
    const end = Date.parse(shown.deadlineAt);
    const t = reveal ? reveal.closedAt : serverNow();
    const k = Math.min(1, Math.max(0, (t - start) / (end - start)));
    return ARENA.zFar + (ARENA.zNear - ARENA.zFar) * k;
  };

  const groups = useRef(new Map<string, Group>());
  const labels = useRef(new Map<string, HTMLDivElement>());
  const register = useCallback((answerId: string, group: Group | null) => {
    if (group) groups.current.set(answerId, group);
    else groups.current.delete(answerId);
  }, []);

  const getTargetPoint = useCallback((answerId: string) => {
    const g = groups.current.get(answerId);
    if (!g) return null;
    const p = g.getWorldPosition(new Vector3());
    p.y += 1.1 * g.scale.y;
    return p;
  }, []);

  const stateOf = (answerId: string): TargetState => {
    if (reveal) {
      if (answerId === reveal.reveal.correctAnswerId) {
        return reveal.outcome === 'HIT_CORRECT' ? 'correct-hit' : 'correct';
      }
      return 'eliminated';
    }
    return shown?.eliminatedAnswerIds.includes(answerId) ? 'eliminated' : 'alive';
  };

  return (
    <>
      <Canvas
        dpr={dpr}
        camera={{ fov: 70, near: 0.1, far: 120 }}
        gl={{ powerPreference: 'high-performance' }}
        className="world"
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(DPR_MIN, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(DPR_MAX, window.devicePixelRatio, d + 0.25))}
        />
        <Environment scenery={palette} />
        {isBoss && <Boss health={bossHealth} hurtAt={lastShot?.outcome === 'ELIMINATED_WRONG' ? lastShot.at : null} />}
        {shown?.answers.map((a, i) => (
          <Target
            key={`${shown.id}:${a.id}`}
            answer={a}
            index={i}
            x={spreadX(i, shown.answers.length)}
            getZ={getZ}
            state={stateOf(a.id)}
            accent={palette.accent}
            hitAt={lastShot?.answerId === a.id ? lastShot.at : null}
            boss={isBoss}
            register={register}
          />
        ))}
        <LabelProjector groups={groups.current} labels={labels.current} />
        <Player
          onShoot={onShoot}
          onLockChange={onLockChange}
          accent={palette.accent}
          aimShot={aimShot}
          getTargetPoint={getTargetPoint}
        />
      </Canvas>
      <div className="labels" aria-hidden>
        {shown?.answers.map((a, i) => {
          const state = stateOf(a.id);
          return (
            <div
              key={`${shown.id}:${a.id}`}
              ref={(el) => {
                if (el) labels.current.set(a.id, el);
                else labels.current.delete(a.id);
              }}
              data-index={i}
              className={`target-label target-label--${state}`}
            >
              <span className="target-key">{i + 1}</span>
              {a.text}
            </div>
          );
        })}
      </div>
    </>
  );
});
