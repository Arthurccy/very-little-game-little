import { useCallback, useEffect, useRef, useState } from 'react';
import { BOSS_QUESTION_COUNT, BOSS_ZONE } from '@fps/shared';
import type { CreateSessionResponse, SessionState, Theme } from '../api/types';
import { isMuted, setMuted, sfx } from './audio';
import { music } from './music';
import { Hud } from './hud/Hud';
import type { AimShot } from './scene/Player';
import { BOSS_PROJECTILE_IMPACT_MS } from './scene/Boss';
import { World } from './scene/World';
import { useGame } from './useGame';

interface Props {
  initial: CreateSessionResponse;
  themes: Theme[];
  onEnded: (session: SessionState) => void;
}

export function GameScreen({ initial, themes, onEnded }: Props) {
  const game = useGame(initial, onEnded);
  const [locked, setLocked] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [aimShot, setAimShot] = useState<AimShot | null>(null);

  const shown = game.reveal?.question ?? game.question;
  const theme = shown && shown.zone !== BOSS_ZONE ? themes[shown.zone - 1] : undefined;
  const bossIndex = shown ? shown.position - (shown.total - BOSS_QUESTION_COUNT) : -1;
  const bossHealth =
    shown?.zone === BOSS_ZONE ? 1 - (Math.max(0, bossIndex) + (game.reveal ? 1 : 0)) / BOSS_QUESTION_COUNT : 1;

  const [musicOn, setMusicOn] = useState(music.isEnabled);
  const toggleMusic = useCallback(() => {
    music.setEnabled(!music.isEnabled());
    setMusicOn(music.isEnabled());
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(!isMuted());
    setMutedState(isMuted());
  }, []);

  // Référence stable vers la dernière version de `shoot`, pour ne pas faire re-rendre la scène.
  const shootRef = useRef(game.shoot);
  shootRef.current = game.shoot;
  const handleShoot = useCallback((answerId: string | null) => {
    if (answerId) shootRef.current(answerId);
    else sfx.shoot();
  }, []);

  // Échap libère la souris : on met la partie en pause. Reprendre la visée relance le chrono.
  const pauseRef = useRef(game.pause);
  pauseRef.current = game.pause;
  const resumeRef = useRef(game.resume);
  resumeRef.current = game.resume;
  const handleLockChange = useCallback((isLocked: boolean) => {
    setLocked(isLocked);
    void (isLocked ? resumeRef.current() : pauseRef.current());
  }, []);

  // Raccourcis clavier : 1 à 6 visent directement une cible (accessibilité), M coupe le son.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'KeyN') toggleMusic();
      // P : pause sans passer par le verrouillage de la souris (ou reprise).
      if (e.code === 'KeyP' && !document.pointerLockElement) void (game.paused ? game.resume() : game.pause());
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && game.question) {
        const answer = game.question.answers[n - 1];
        // La balle ne part que si le tir est accepté (cible vivante, question en cours, pas de pause).
        if (answer && game.shoot(answer.id)) setAimShot({ answerId: answer.id, at: performance.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, toggleMute, toggleMusic]);

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

  // Musique : une boucle par décor, celle du boss en zone finale ; arrêt en fin de partie.
  const musicKey =
    game.session.status !== 'IN_PROGRESS' ? null : shown?.zone === BOSS_ZONE ? 'boss' : (theme?.scenery ?? null);
  useEffect(() => {
    if (musicKey) music.play(musicKey);
    else music.stop();
  }, [musicKey]);
  useEffect(() => () => music.stop(), []);

  // Libère la souris à la fin de la partie.
  useEffect(() => {
    if (game.session.status !== 'IN_PROGRESS' && document.pointerLockElement) document.exitPointerLock();
  }, [game.session.status]);

  // Flash rouge quand le joueur perd des PV (bonne réponse touchée ou chrono échu).
  // Pendant le boss, il coïncide avec l'impact du projectile tiré par le boss.
  const hurtDelay = game.lastClose?.zone === BOSS_ZONE ? BOSS_PROJECTILE_IMPACT_MS : 0;
  const sinceClose = game.lastClose ? performance.now() - game.lastClose.at - hurtDelay : Infinity;
  const hurt = game.lastClose?.outcome !== 'ELIMINATED_WRONG' && sinceClose >= 0 && sinceClose < 450;

  return (
    <div className={`game ${hurt ? 'game--hurt' : ''} ${game.paused ? 'game--paused' : ''}`}>
      <World
        question={shown}
        reveal={game.reveal}
        serverNow={game.serverNow}
        frozenAt={game.paused ? game.pausedAt : null}
        lastShot={game.lastShot}
        lastClose={game.lastClose}
        scenery={theme?.scenery}
        bossHealth={bossHealth}
        onShoot={handleShoot}
        onLockChange={handleLockChange}
        aimShot={aimShot}
      />
      <Hud
        game={game}
        theme={theme}
        nextTheme={game.upcoming && game.upcoming.zone !== BOSS_ZONE ? themes[game.upcoming.zone - 1] : undefined}
        locked={locked}
        muted={muted}
        onToggleMute={toggleMute}
        musicOn={musicOn}
        onToggleMusic={toggleMusic}
        onAbandon={() => void game.abandon()}
        bossHealth={bossHealth}
      />
    </div>
  );
}
