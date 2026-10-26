import {
  BOSS_QUESTION_COUNT,
  HIT_CORRECT_PENALTY,
  STANDARD_QUESTIONS_PER_ZONE,
  STARTING_HP,
  TIMEOUT_PENALTY,
  type GameMode,
  type ThemeDTO,
} from '@fps/shared';
import { useAuth } from '../auth/AuthContext';

interface Props {
  themes: ThemeDTO[];
  starting: boolean;
  error: string | null;
  onStart: (mode: GameMode) => void;
  onLeaderboard: () => void;
  onAdmin: () => void;
}

export function MenuScreen({ themes, starting, error, onStart, onLeaderboard, onAdmin }: Props) {
  const { user, logout } = useAuth();
  return (
    <main className="panel">
      <header className="panel__header">
        <div>
          <h1 className="title">FPS éducatif</h1>
          <p className="tagline">Salut {user?.pseudo} ! Élimine les mauvaises réponses, épargne la bonne.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
          Se déconnecter
        </button>
      </header>

      <div className="menu-actions">
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={starting}
          onClick={() => onStart('NORMAL')}
        >
          Jouer
        </button>
        <button type="button" className="btn btn--big" disabled={starting} onClick={() => onStart('TRAINING')}>
          Entraînement
        </button>
        <button type="button" className="btn" onClick={onLeaderboard}>
          Classement
        </button>
        {user?.role === 'ADMIN' && (
          <button type="button" className="btn" onClick={onAdmin}>
            Back-office
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="rules-grid">
        <div>
          <h2>Règles</h2>
          <ul>
            <li>{STARTING_HP} PV au départ.</li>
            <li>Chaque cible porte une réponse : abats toutes les mauvaises avant la fin du chrono.</li>
            <li>
              Tirer sur la bonne réponse : −{HIT_CORRECT_PENALTY} PV. Chrono écoulé : −{TIMEOUT_PENALTY} PV.
            </li>
            <li>Les réussites enchaînées montent le combo, jusqu’à ×4. Plus tu es rapide, plus tu marques.</li>
            <li>Des bonus tombent parfois : ralenti, réponse retirée, soin.</li>
            <li>L’entraînement ne coûte aucun PV et ne compte pas au classement.</li>
          </ul>
        </div>
        <div>
          <h2>Parcours</h2>
          <ol>
            {themes.map((t) => (
              <li key={t.id}>
                <strong>{t.name}</strong> — {STANDARD_QUESTIONS_PER_ZONE} questions
              </li>
            ))}
            <li>
              <strong>Boss final</strong> — {BOSS_QUESTION_COUNT} questions mélangées
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
