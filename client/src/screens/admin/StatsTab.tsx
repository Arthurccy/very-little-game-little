import { useEffect, useMemo, useState } from 'react';
import type { QuestionStatDTO, ThemeDTO } from '@fps/shared';
import { adminApi } from '../../api/endpoints';

type Sort = 'success' | 'attempts' | 'time';

export function StatsTab({ themes }: { themes: ThemeDTO[] }) {
  const [stats, setStats] = useState<QuestionStatDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('success');
  const [theme, setTheme] = useState('');

  useEffect(() => {
    adminApi.stats().then(setStats, (e: Error) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!stats) return [];
    const filtered = stats.filter((s) => !theme || s.themeSlug === theme);
    const key = (s: QuestionStatDTO) =>
      sort === 'success' ? (s.successRate ?? 2) : sort === 'attempts' ? -s.attempts : (s.averageElapsedMs ?? 0) * -1;
    return [...filtered].sort((a, b) => key(a) - key(b));
  }, [stats, sort, theme]);

  const totals = useMemo(() => {
    const attempts = rows.reduce((n, r) => n + r.attempts, 0);
    const cleared = rows.reduce((n, r) => n + (r.successRate ?? 0) * r.attempts, 0);
    return { attempts, rate: attempts ? cleared / attempts : null };
  }, [rows]);

  return (
    <section>
      <div className="toolbar">
        <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Thème">
          <option value="">Tous les thèmes</option>
          {themes.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Tri">
          <option value="success">Les plus ratées d’abord</option>
          <option value="attempts">Les plus jouées d’abord</option>
          <option value="time">Les plus lentes d’abord</option>
        </select>
        <span className="muted">
          {totals.attempts} tentatives · réussite globale{' '}
          {totals.rate === null ? '—' : `${Math.round(totals.rate * 100)} %`}
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Thème</th>
            <th>Énoncé</th>
            <th className="num">Tentatives</th>
            <th>Réussite</th>
            <th className="num">Temps moyen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.questionId} className={s.isActive ? undefined : 'inactive'}>
              <td>
                {s.themeSlug}
                {s.kind === 'BOSS' && <span className="badge">boss</span>}
              </td>
              <td>{s.statement}</td>
              <td className="num">{s.attempts}</td>
              <td>
                {s.successRate === null ? (
                  <span className="muted">—</span>
                ) : (
                  <div className="rate">
                    <div className="rate__bar" style={{ width: `${s.successRate * 100}%` }} />
                    <span>{Math.round(s.successRate * 100)} %</span>
                  </div>
                )}
              </td>
              <td className="num">
                {s.averageElapsedMs === null ? '—' : `${(s.averageElapsedMs / 1000).toFixed(1)} s`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
