import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOSS_QUESTION_COUNT,
  BOSS_ZONE,
  type CreateSessionResponse,
  type SessionStateDTO,
  type ThemeDTO,
} from '@fps/shared';
import { isMuted, setMuted, sfx } from './audio';
import { Hud } from './hud/Hud';
import { World } from './scene/World';
import { useGame } from './useGame';

interface Props {
  initial: CreateSessionResponse;
  themes: ThemeDTO[];
  onEnded: (session: SessionStateDTO) => void;
}

export function GameScreen({ initial, themes, onEnded }: Props) {
  const game = useGame(initial, onEnded);
  const [locked, setLocked] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  const shown = game.reveal?.question ?? game.question;
  const theme = shown && shown.zone !== BOSS_ZONE ? themes[shown.zone - 1] : undefined;
  const bossIndex = shown ? shown.position - (shown.total - BOSS_QUESTION_COUNT) : -1;
  const bossHealth =
    shown?.zone === BOSS_ZONE ? 1 - (Math.max(0, bossIndex) + (game.reveal ? 1 : 0)) / BOSS_QUESTION_COUNT : 1;

  const toggleMute = useCallback(() => {
    setMuted(!isMuted());
    setMutedState(isMuted());
  }, []);

  const handleShoot = useCallback(
    (answerId: string | null) => {
      if (answerId) void game.shoot(answerId);
      else sfx.shoot();
    },
    [game],
  );

  // Raccourcis clavier : 1 à 6 visent directement une cible (accessibilité), M coupe le son.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') toggleMute();
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && game.question) {
        const answer = game.question.answers[n - 1];
        if (answer) void game.shoot(answer.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, toggleMute]);

  // Sons d'ambiance : compte à rebours et entrée du boss.
  const lastTick = useRef<number | null>(null);
  const bossAnnounced = useRef(false);
  useEffect(() => {
    if (game.phase === 'countdown' && game.question) {
      const s = Math.ceil((Date.parse(game.question.startedAt) - game.now) / 1000);
      if (s !== lastTick.current && s > 0) {
        lastTick.current = s;
        sfx.tick();
      }
    }
    if (game.question?.zone === BOSS_ZONE && !bossAnnounced.current) {
      bossAnnounced.current = true;
      sfx.bossEnter();
    }
  }, [game.phase, game.now, game.question]);

  // Libère la souris à la fin de la partie.
  useEffect(() => {
    if (game.session.status !== 'IN_PROGRESS' && document.pointerLockElement) document.exitPointerLock();
  }, [game.session.status]);

  return (
    <div
      className={`game ${game.lastShot?.outcome === 'HIT_CORRECT' && performance.now() - game.lastShot.at < 400 ? 'game--hurt' : ''}`}
    >
      <World
        game={game}
        scenery={theme?.scenery}
        bossHealth={bossHealth}
        onShoot={handleShoot}
        onLockChange={setLocked}
      />
      <Hud
        game={game}
        theme={theme}
        nextTheme={game.upcoming && game.upcoming.zone !== BOSS_ZONE ? themes[game.upcoming.zone - 1] : undefined}
        locked={locked}
        muted={muted}
        onToggleMute={toggleMute}
        onAbandon={() => void game.abandon()}
        bossHealth={bossHealth}
      />
    </div>
  );
}
