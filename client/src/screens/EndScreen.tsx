import { useEffect, useState } from 'react';
import type { SessionStateDTO } from '@fps/shared';
import type { HubScore, SessionSummary } from '../api/types';
import { gameApi } from '../api/endpoints';

interface Props {
  session: SessionStateDTO;
  onReplay: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
}

const TITLES: Record<SessionStateDTO['status'], string> = {
  WON: 'Victoire !',
  LOST: 'Game over',
  ABANDONED: 'Partie abandonnée',
  IN_PROGRESS: 'Partie en cours',
};

export function EndScreen({ session, onReplay, onLeaderboard, onMenu }: Props) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameApi.summary(session.id).then(setSummary, (e: Error) => setError(`Bilan indisponible : ${e.message}`));
  }, [session.id]);

  const final = summary?.session ?? session;
  const ranked = final.mode === 'NORMAL' && (final.status === 'WON' || final.status === 'LOST');

  return (
    <main className="panel panel--narrow end">
      <h1 className={`title title--${final.status.toLowerCase()}`}>{TITLES[final.status]}</h1>
      <p className="end__score">{final.score} pts</p>
      <dl className="stats">
        <div>
          <dt>Questions réussies</dt>
          <dd>{summary ? `${summary.cleared} / ${final.total}` : error ? '—' : '…'}</dd>
        </div>
        <div>
          <dt>Questions ratées</dt>
          <dd>{summary?.failed ?? (error ? '—' : '…')}</dd>
        </div>
        <div>
          <dt>Meilleur combo</dt>
          <dd>{summary?.bestCombo ?? (error ? '—' : '…')}</dd>
        </div>
        <div>
          <dt>PV restants</dt>
          <dd>{final.hp}</dd>
        </div>
      </dl>
      {summary?.hub && <HubResult hub={summary.hub} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        {final.mode === 'TRAINING'
          ? 'Partie d’entraînement : hors classement.'
          : ranked
            ? 'Ton score est enregistré au classement.'
            : 'Une partie abandonnée ne compte pas au classement.'}
      </p>
      <div className="menu-actions">
        <button type="button" className="btn btn--primary" onClick={onReplay}>
          Rejouer
        </button>
        <button type="button" className="btn" onClick={onLeaderboard}>
          Classement
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </main>
  );
}

/** Résultat de l'envoi du score au hub Full-Stack Quest (fait par notre back). */
function HubResult({ hub }: { hub: HubScore }) {
  if (hub.status === 'SENT' && hub.result) {
    return (
      <p className="hub-badge hub-badge--ok">
        {hub.result.xpGained > 0
          ? `Score envoyé à Full-Stack Quest : +${hub.result.xpGained} XP`
          : 'Score envoyé à Full-Stack Quest (sans XP : bac à sable ou niveau déjà validé aujourd’hui)'}
      </p>
    );
  }
  if (hub.status === 'FAILED') {
    return (
      <p className="hub-badge hub-badge--error" role="alert">
        Le score n’a pas pu être envoyé à Full-Stack Quest.
      </p>
    );
  }
  return null;
}
