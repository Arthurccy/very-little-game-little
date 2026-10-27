import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_PAUSE_MS,
  type BonusDrop,
  type CreateSessionResponse,
  type PublicQuestion,
  type QuestionReveal,
  type SessionDetailResponse,
  type SessionStateDTO,
  type ShotOutcome,
  type ShotResponse,
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

/** Clôture d'une question (réussite, bonne réponse touchée ou chrono échu). */
export interface CloseFx {
  outcome: ShotOutcome;
  zone: number;
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

/** Tir en attente d'envoi, rattaché à la question visée. */
interface QueuedShot {
  answerId: string;
  questionId: string;
}

/**
 * État de partie piloté par le serveur. Le client ne décide de rien : il affiche,
 * envoie les tirs et signale l'échéance ; l'horloge locale est recalée sur `serverNow`.
 *
 * Les tirs passent par une file : un tir n'est jamais perdu parce que le précédent attend
 * encore la réponse du serveur. La file est vidée quand la question se termine.
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
  const [lastClose, setLastClose] = useState<CloseFx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(serverNow);

  /** Question qui accepte des tirs (null pendant l'explication ou le compte à rebours suivant). */
  const openQuestion = useRef<PublicQuestion | null>(initial.question);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const queue = useRef<QueuedShot[]>([]);
  /** Une requête de jeu (tir ou timeout) est en cours : elles sont envoyées une par une. */
  const busy = useRef(false);
  const ended = useRef(false);
  const resyncing = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const paused = session.paused;
  /** Début de la pause (heure serveur, ms) ; l'horloge de jeu affichée est gelée à cet instant. */
  const pausedAt = session.pauseEndsAt ? Date.parse(session.pauseEndsAt) - MAX_PAUSE_MS : null;
  const clockNow = paused && pausedAt !== null ? Math.min(now, pausedAt) : now;

  const phase: Phase =
    session.status !== 'IN_PROGRESS' && !reveal
      ? 'ended'
      : reveal
        ? 'reveal'
        : question && clockNow < Date.parse(question.startedAt)
          ? 'countdown'
          : 'active';

  const resync = useCallback(async () => {
    if (resyncing.current) return;
    resyncing.current = true;
    try {
      const res = await gameApi.getSession(session.id);
      offsetRef.current = Date.parse(res.serverNow) - Date.now();
      queue.current = [];
      openQuestion.current = res.question;
      setSession(res.session);
      setQuestion(res.question);
      setUpcoming(null);
      setReveal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de synchronisation');
    } finally {
      resyncing.current = false;
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
        openQuestion.current = res.question;
        setQuestion(res.question);
        return;
      }

      openQuestion.current = null;
      queue.current = [];
      setLastClose({ outcome: res.outcome, zone: current.zone, at: performance.now() });
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

  /** Envoie les tirs en attente, un par un, tant que leur question est toujours ouverte. */
  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length > 0) {
        const shot = queue.current.shift()!;
        const q = openQuestion.current;
        if (!q || q.id !== shot.questionId) continue;
        // La cible a pu tomber entre-temps (bonus REMOVE_WRONG lâché par un tir précédent).
        if (q.eliminatedAnswerIds.includes(shot.answerId)) continue;
        try {
          apply(await gameApi.shoot(session.id, shot.answerId), q, shot.answerId);
        } catch (err) {
          // 400 : ce tir seul est invalide, les suivants restent valables.
          if (err instanceof ApiRequestError && err.status === 400) continue;
          queue.current = [];
          if (err instanceof ApiRequestError && err.status === 409) await resync();
          else setError(err instanceof Error ? err.message : 'Tir non transmis');
        }
      }
    } finally {
      busy.current = false;
    }
  }, [session.id, apply, resync]);

  /**
   * Tire sur une réponse. Renvoie false si le tir ne peut pas partir (pause, compte à rebours,
   * explication, cible déjà abattue ou déjà visée). Lit des refs : sûr depuis un gestionnaire d'événement.
   */
  const shoot = useCallback(
    (answerId: string): boolean => {
      const q = openQuestion.current;
      if (!q || sessionRef.current.paused || serverNow() < Date.parse(q.startedAt)) {
        sfx.denied();
        return false;
      }
      const pending = queue.current.some((s) => s.questionId === q.id && s.answerId === answerId);
      if (q.eliminatedAnswerIds.includes(answerId) || pending) return false;
      queue.current.push({ answerId, questionId: q.id });
      sfx.shoot();
      void drain();
      return true;
    },
    [serverNow, drain],
  );

  const reportTimeout = useCallback(async () => {
    const q = openQuestion.current;
    if (!q || busy.current) return;
    busy.current = true;
    try {
      apply(await gameApi.timeout(session.id), q, null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) await resync();
      else setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      busy.current = false;
    }
  }, [session.id, apply, resync]);

  /** Applique la réponse de pause/reprise : état de partie et horaires décalés de la question. */
  const applyDetail = useCallback(
    (res: SessionDetailResponse) => {
      offsetRef.current = Date.parse(res.serverNow) - Date.now();
      setSession(res.session);
      const q = res.question;
      if (!q) return;
      if (upcoming && q.id === upcoming.id) {
        setUpcoming(q);
      } else if (question && q.id === question.id) {
        setQuestion(q);
        if (openQuestion.current?.id === q.id) openQuestion.current = q;
      }
    },
    [upcoming, question],
  );

  const pause = useCallback(async () => {
    const s = sessionRef.current;
    if (ended.current || s.status !== 'IN_PROGRESS' || s.paused || s.pausesLeft === 0) return;
    try {
      applyDetail(await gameApi.pause(s.id));
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) await resync();
    }
  }, [applyDetail, resync]);

  const resume = useCallback(async () => {
    const s = sessionRef.current;
    if (!s.paused) return;
    try {
      applyDetail(await gameApi.resume(s.id));
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) await resync();
    }
  }, [applyDetail, resync]);

  // Boucle d'horloge : rafraîchit l'affichage, enchaîne la question suivante, signale l'échéance.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = serverNow();
      setNow(t);
      if (upcoming && !paused && t >= Date.parse(upcoming.startedAt)) {
        openQuestion.current = upcoming;
        setQuestion(upcoming);
        setUpcoming(null);
        setReveal(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [serverNow, upcoming, paused]);

  useEffect(() => {
    if (!paused && phase === 'active' && question && now >= Date.parse(question.deadlineAt) + TIMEOUT_GRACE_MS) {
      void reportTimeout();
    }
  }, [paused, phase, question, now, reportTimeout]);

  // Pause expirée côté serveur : on se resynchronise (le serveur relance le chrono).
  useEffect(() => {
    if (paused && session.pauseEndsAt && now >= Date.parse(session.pauseEndsAt)) void resync();
  }, [paused, session.pauseEndsAt, now, resync]);

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
    /** Heure de jeu : gelée pendant une pause. À utiliser pour les chronos affichés. */
    clockNow,
    paused,
    pausedAt,
    serverNow,
    lastShot,
    lastClose,
    bonus,
    error,
    clearError: () => setError(null),
    shoot,
    pause,
    resume,
    abandon,
  };
}

export type GameController = ReturnType<typeof useGame>;
