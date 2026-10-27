import { useEffect, useState } from 'react';
import type { SessionStateDTO, SessionSummaryDTO } from '@fps/shared';
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
  const [summary, setSummary] = useState<SessionSummaryDTO | null>(null);

  useEffect(() => {
    gameApi.summary(session.id).then(setSummary, () => setSummary(null));
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
          <dd>{summary ? `${summary.cleared} / ${final.total}` : '…'}</dd>
        </div>
        <div>
          <dt>Questions ratées</dt>
          <dd>{summary?.failed ?? '…'}</dd>
        </div>
        <div>
          <dt>Meilleur combo</dt>
          <dd>{summary?.bestCombo ?? '…'}</dd>
        </div>
        <div>
          <dt>PV restants</dt>
          <dd>{final.hp}</dd>
        </div>
      </dl>
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
