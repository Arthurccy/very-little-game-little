import { useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Group } from 'three';
import { BOSS_ZONE, type PublicQuestion } from '@fps/shared';
import type { GameController } from '../useGame';
import { Boss } from './Boss';
import { Environment } from './Environment';
import { LabelProjector } from './Labels';
import { Player } from './Player';
import { ARENA, sceneryFor } from './sceneries';
import { Target, type TargetState } from './Target';

interface Props {
  game: GameController;
  scenery: string | undefined;
  bossHealth: number;
  onShoot: (answerId: string | null) => void;
  onLockChange: (locked: boolean) => void;
}

/** Position latérale des cibles, réparties en éventail. */
function spreadX(index: number, count: number): number {
  const width = Math.min(18, 5 * (count - 1));
  return count === 1 ? 0 : -width / 2 + (width * index) / (count - 1);
}

export function World({ game, scenery, bossHealth, onShoot, onLockChange }: Props) {
  const shown: PublicQuestion | null = game.reveal?.question ?? game.question;
  const isBoss = shown?.zone === BOSS_ZONE;
  const palette = sceneryFor(isBoss ? 'boss' : scenery);

  // L'avancée des ennemis reflète le temps restant ; elle n'inflige aucun dégât.
  // Pendant l'explication, les cibles restent figées là où elles étaient à la clôture.
  const getZ = () => {
    if (!shown) return ARENA.zFar;
    const start = Date.parse(shown.startedAt);
    const end = Date.parse(shown.deadlineAt);
    const t = game.reveal ? game.reveal.closedAt : game.serverNow();
    const k = Math.min(1, Math.max(0, (t - start) / (end - start)));
    return ARENA.zFar + (ARENA.zNear - ARENA.zFar) * k;
  };

  const groups = useRef(new Map<string, Group>());
  const labels = useRef(new Map<string, HTMLDivElement>());
  const register = useCallback((answerId: string, group: Group | null) => {
    if (group) groups.current.set(answerId, group);
    else groups.current.delete(answerId);
  }, []);

  const stateOf = (answerId: string): TargetState => {
    if (game.reveal) {
      if (answerId === game.reveal.reveal.correctAnswerId) {
        return game.reveal.outcome === 'HIT_CORRECT' ? 'correct-hit' : 'correct';
      }
      return 'eliminated';
    }
    return shown?.eliminatedAnswerIds.includes(answerId) ? 'eliminated' : 'alive';
  };

  return (
    <>
      <Canvas shadows="percentage" camera={{ fov: 70, near: 0.1, far: 120 }} className="world">
        <Environment scenery={palette} />
        {isBoss && (
          <Boss health={bossHealth} hurtAt={game.lastShot?.outcome === 'ELIMINATED_WRONG' ? game.lastShot.at : null} />
        )}
        {shown?.answers.map((a, i) => (
          <Target
            key={`${shown.id}:${a.id}`}
            answer={a}
            index={i}
            x={spreadX(i, shown.answers.length)}
            getZ={getZ}
            state={stateOf(a.id)}
            accent={palette.accent}
            hitAt={game.lastShot?.answerId === a.id ? game.lastShot.at : null}
            boss={isBoss}
            register={register}
          />
        ))}
        <LabelProjector groups={groups.current} labels={labels.current} />
        <Player onShoot={onShoot} onLockChange={onLockChange} />
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
}
