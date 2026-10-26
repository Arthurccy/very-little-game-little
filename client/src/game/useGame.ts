import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BonusDrop,
  CreateSessionResponse,
  PublicQuestion,
  QuestionReveal,
  SessionStateDTO,
  ShotOutcome,
  ShotResponse,
} from '@fps/shared';
import { ApiRequestError } from '../api/client';
import { gameApi } from '../api/endpoints';
import { sfx } from './audio';

export type Phase = 'countdown' | 'active' | 'reveal' | 'ended';

export interface RevealState {
  /** Instantané de la question close (cibles à afficher pendant l'explication). */
  question: PublicQuestion;
  outcome: ShotOutcome;
  reveal: QuestionReveal;
  /** Heure serveur de la clôture (ms). */
  closedAt: number;
}

export interface ShotFx {
  answerId: string;
  outcome: ShotOutcome;
  /** Horodatage local, pour déclencher les effets visuels. */
  at: number;
}

export interface BonusFx {
  drop: BonusDrop;
  at: number;
}

/** Durée d'affichage de la dernière explication avant l'écran de fin. */
const END_DELAY_MS = 4500;
/** Marge après l'échéance avant de signaler le timeout (latence réseau). */
const TIMEOUT_GRACE_MS = 150;

/**
 * État de partie piloté par le serveur. Le client ne décide de rien : il affiche,
 * envoie les tirs et signale l'échéance ; l'horloge locale est recalée sur `serverNow`.
 */
export function useGame(initial: CreateSessionResponse, onEnded: (session: SessionStateDTO) => void) {
  const offsetRef = useRef(Date.parse(initial.serverNow) - Date.now());
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const [session, setSession] = useState(initial.session);
  const [question, setQuestion] = useState<PublicQuestion | null>(initial.question);
  const [upcoming, setUpcoming] = useState<PublicQuestion | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [lastShot, setLastShot] = useState<ShotFx | null>(null);
  const [bonus, setBonus] = useState<BonusFx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(serverNow);

  const inFlight = useRef(false);
  const ended = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const phase: Phase =
    session.status !== 'IN_PROGRESS' && !reveal
      ? 'ended'
      : reveal
        ? 'reveal'
        : question && now < Date.parse(question.startedAt)
          ? 'countdown'
          : 'active';

  const resync = useCallback(async () => {
    try {
      const res = await gameApi.getSession(session.id);
      offsetRef.current = Date.parse(res.serverNow) - Date.now();
      setSession(res.session);
      setQuestion(res.question);
      setUpcoming(null);
      setReveal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de synchronisation');
    }
  }, [session.id]);

  const finish = useCallback((final: SessionStateDTO) => {
    if (ended.current) return;
    ended.current = true;
    setTimeout(() => {
      if (final.status === 'WON') sfx.victory();
      else if (final.status === 'LOST') sfx.defeat();
      setReveal(null);
      onEndedRef.current(final);
    }, END_DELAY_MS);
  }, []);

  const apply = useCallback(
    (res: ShotResponse, current: PublicQuestion, shotAnswerId: string | null) => {
      offsetRef.current = Date.parse(res.serverNow) - Date.now();
      setSession(res.session);
      if (shotAnswerId) setLastShot({ answerId: shotAnswerId, outcome: res.outcome, at: performance.now() });
      if (res.bonus) {
        setBonus({ drop: res.bonus, at: performance.now() });
        sfx.bonus();
      }

      if (!res.questionClosed) {
        sfx.eliminate();
        setQuestion(res.question);
        return;
      }

      const correct = res.reveal!.correctAnswerId;
      if (res.outcome === 'HIT_CORRECT') sfx.hitCorrect();
      else if (res.outcome === 'TIMEOUT') sfx.timeout();
      else sfx.cleared();

      const eliminated =
        res.outcome === 'ELIMINATED_WRONG'
          ? current.answers.filter((a) => a.id !== correct).map((a) => a.id)
          : (res.question?.eliminatedAnswerIds ?? current.eliminatedAnswerIds);
      setReveal({
        question: { ...current, eliminatedAnswerIds: eliminated },
        outcome: res.outcome,
        reveal: res.reveal!,
        closedAt: Date.parse(res.serverNow),
      });
      setUpcoming(res.nextQuestion);
      if (res.session.status !== 'IN_PROGRESS') finish(res.session);
    },
    [finish],
  );

  const shoot = useCallback(
    async (answerId: string) => {
      if (phase !== 'active' || !question || inFlight.current) {
        sfx.denied();
        return;
      }
      if (question.eliminatedAnswerIds.includes(answerId)) return;
      inFlight.current = true;
      sfx.shoot();
      try {
        apply(await gameApi.shoot(session.id, answerId), question, answerId);
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 409 || err.status === 400)) await resync();
        else setError(err instanceof Error ? err.message : 'Tir non transmis');
      } finally {
        inFlight.current = false;
      }
    },
    [phase, question, session.id, apply, resync],
  );

  const reportTimeout = useCallback(async () => {
    if (!question || inFlight.current) return;
    inFlight.current = true;
    try {
      apply(await gameApi.timeout(session.id), question, null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) await resync();
      else setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      inFlight.current = false;
    }
  }, [question, session.id, apply, resync]);

  // Boucle d'horloge : rafraîchit l'affichage, enchaîne la question suivante, signale l'échéance.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = serverNow();
      setNow(t);
      if (upcoming && t >= Date.parse(upcoming.startedAt)) {
        setQuestion(upcoming);
        setUpcoming(null);
        setReveal(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [serverNow, upcoming]);

  useEffect(() => {
    if (phase === 'active' && question && now >= Date.parse(question.deadlineAt) + TIMEOUT_GRACE_MS) {
      void reportTimeout();
    }
  }, [phase, question, now, reportTimeout]);

  const abandon = useCallback(async () => {
    try {
      const res = await gameApi.end(session.id);
      ended.current = true;
      onEndedRef.current(res.session);
    } catch {
      onEndedRef.current(session);
    }
  }, [session]);

  return {
    session,
    question,
    upcoming,
    reveal,
    phase,
    now,
    serverNow,
    lastShot,
    bonus,
    error,
    clearError: () => setError(null),
    shoot,
    abandon,
  };
}

export type GameController = ReturnType<typeof useGame>;
