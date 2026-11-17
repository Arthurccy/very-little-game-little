import { useEffect, useState } from 'react';
import type { SessionState } from '../api/types';
import type { HubScore, SessionSummaryWithHub } from '../api/hub-relay';
import type { FailedQuestionReview } from '../game/useGame';
import { gameApi } from '../api/endpoints';

interface Props {
  session: SessionState;
  failedQuestions?: FailedQuestionReview[];
  onReplay: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
}

const TITLES: Record<SessionState['status'], string> = {
  WON: 'Victoire !',
  LOST: 'Game over',
  ABANDONED: 'Partie abandonnée',
  IN_PROGRESS: 'Partie en cours',
};

const ZONE_LABELS: Record<number, string> = {
  1: 'Zone 1 · HTTP',
  2: 'Zone 2 · REST',
  3: 'Zone 3 · CORS',
  4: 'Zone 4 · Auth',
  5: 'Zone 5 · Failles Web',
  6: 'Zone 6 · Cache',
  7: 'Finale · Boss',
};

export function EndScreen({ session, failedQuestions, onReplay, onLeaderboard, onMenu }: Props) {
  const [summary, setSummary] = useState<SessionSummaryWithHub | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameApi.summary(session.id).then(setSummary, (e: Error) => setError(`Bilan indisponible : ${e.message}`));
  }, [session.id]);

  const final = summary?.session ?? session;
  const ranked = final.mode === 'NORMAL' && (final.status === 'WON' || final.status === 'LOST');
  const hasFailed = Boolean(failedQuestions && failedQuestions.length > 0);

  return (
    <main className={`panel ${hasFailed ? 'panel--review' : 'panel--narrow'} end`}>
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

      {hasFailed && (
        <section className="end__review" aria-labelledby="review-title">
          <h2 id="review-title" className="end__review-title">
            Questions à réviser ({failedQuestions!.length})
          </h2>
          <p className="end__review-subtitle">Analyse tes erreurs pour consolider tes connaissances :</p>
          <ul className="review-list">
            {failedQuestions!.map((q) => (
              <li key={q.id} className="review-item">
                <div className="review-item__header">
                  <span className="review-item__theme">{ZONE_LABELS[q.zone] ?? q.themeSlug.toUpperCase()}</span>
                  <span className={`badge badge--outcome ${q.outcome === 'TIMEOUT' ? 'badge--timeout' : 'badge--hit'}`}>
                    {q.outcome === 'TIMEOUT' ? 'Chrono expiré' : 'Bonne réponse abattue'}
                  </span>
                </div>
                <p className="review-item__statement">{q.statement}</p>
                <div className="review-item__answer">
                  <strong>Bonne réponse à épargner :</strong> {q.correctAnswerText}
                </div>
                <div className="review-item__explanation">
                  <strong>Explication :</strong> {q.explanation}
                </div>
                {q.mdnUrl && (
                  <a href={q.mdnUrl} target="_blank" rel="noopener noreferrer" className="review-item__mdn">
                    Consulter la documentation MDN ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
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
