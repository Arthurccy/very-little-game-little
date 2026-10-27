import { useCallback, useEffect, useState } from 'react';
import type { AdminQuestionDTO, QuestionKind, ThemeDTO } from '@fps/shared';
import { adminApi } from '../../api/endpoints';
import { QuestionForm } from './QuestionForm';

export function QuestionsTab({ themes }: { themes: ThemeDTO[] }) {
  const [themeId, setThemeId] = useState('');
  const [kind, setKind] = useState<QuestionKind | ''>('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [questions, setQuestions] = useState<AdminQuestionDTO[] | null>(null);
  const [editing, setEditing] = useState<AdminQuestionDTO | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .list({ themeId: themeId || undefined, kind: kind || undefined, includeInactive })
      .then(setQuestions, (e: Error) => setError(e.message));
  }, [themeId, kind, includeInactive]);

  useEffect(load, [load]);

  async function toggleActive(q: AdminQuestionDTO) {
    try {
      if (q.isActive) await adminApi.deactivate(q.id);
      else await adminApi.update(q.id, { ...q, isActive: true });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  if (editing) {
    return (
      <QuestionForm
        themes={themes}
        initial={editing === 'new' ? null : editing}
        defaultThemeId={themeId || themes[0]?.id || ''}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <section>
      <div className="toolbar">
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Thème">
          <option value="">Tous les thèmes</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as QuestionKind | '')} aria-label="Type">
          <option value="">Standard et boss</option>
          <option value="STANDARD">Standard</option>
          <option value="BOSS">Boss</option>
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Afficher les désactivées
        </label>
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
          Nouvelle question
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {questions && (
        <table className="table">
          <thead>
            <tr>
              <th>Thème</th>
              <th>Type</th>
              <th>Énoncé</th>
              <th className="num">Diff.</th>
              <th className="num">Rép.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className={q.isActive ? undefined : 'inactive'}>
                <td>{q.themeSlug}</td>
                <td>{q.kind === 'BOSS' ? 'Boss' : 'Standard'}</td>
                <td>{q.statement}</td>
                <td className="num">{q.difficulty}</td>
                <td className="num">{q.answers.length}</td>
                <td className="actions">
                  <button type="button" className="btn btn--small" onClick={() => setEditing(q)}>
                    Modifier
                  </button>
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => void toggleActive(q)}>
                    {q.isActive ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
