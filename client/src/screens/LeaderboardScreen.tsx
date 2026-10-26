import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@fps/shared';
import { gameApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

export function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameApi.leaderboard(20).then(setEntries, (e: Error) => setError(e.message));
  }, []);

  return (
    <main className="panel panel--narrow">
      <header className="panel__header">
        <h1 className="title">Classement</h1>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Retour
        </button>
      </header>
      <p className="muted">Meilleure partie de chaque joueur (mode normal).</p>
      {error && <p className="error">{error}</p>}
      {entries && entries.length === 0 && <p>Personne n’a encore terminé de partie. À toi de jouer !</p>}
      {entries && entries.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th className="num">Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.rank} className={e.pseudo === user?.pseudo ? 'me' : undefined}>
                <td>{e.rank}</td>
                <td>{e.pseudo}</td>
                <td className="num">{e.score}</td>
                <td>{new Date(e.endedAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
