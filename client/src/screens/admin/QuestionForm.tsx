import { useState, type FormEvent } from 'react';
import type { AdminAnswerInput, AdminQuestion, AdminQuestionInput, QuestionKind, Theme } from '../../api/types';
import { ApiRequestError } from '../../api/client';
import { adminApi } from '../../api/endpoints';

interface Props {
  themes: Theme[];
  initial: AdminQuestion | null;
  defaultThemeId: string;
  onCancel: () => void;
  onSaved: () => void;
}

const emptyAnswers = (): AdminAnswerInput[] => [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

export function QuestionForm({ themes, initial, defaultThemeId, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<AdminQuestionInput>(() =>
    initial
      ? { ...initial }
      : {
          themeId: defaultThemeId,
          statement: '',
          explanation: '',
          mdnUrl: null,
          difficulty: 1,
          kind: 'STANDARD',
          timeLimitMs: 20000,
          basePoints: 100,
          answers: emptyAnswers(),
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof AdminQuestionInput>(key: K, value: AdminQuestionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setAnswer = (i: number, patch: Partial<AdminAnswerInput>) =>
    setForm((f) => ({
      ...f,
      answers: f.answers.map((a, j) => {
        if (patch.isCorrect) return { ...a, isCorrect: j === i, ...(j === i ? patch : {}) };
        return j === i ? { ...a, ...patch } : a;
      }),
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: AdminQuestionInput = { ...form, mdnUrl: form.mdnUrl?.trim() ? form.mdnUrl.trim() : null };
    try {
      if (initial) await adminApi.update(initial.id, body);
      else await adminApi.create(body);
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.details)) {
        setError(
          (err.details as { path: string; message: string }[]).map((d) => `${d.path} : ${d.message}`).join(' · '),
        );
      } else {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form form--wide" onSubmit={submit}>
      <h2>{initial ? 'Modifier la question' : 'Nouvelle question'}</h2>
      <div className="form__row">
        <label>
          Thème
          <select value={form.themeId} onChange={(e) => set('themeId', e.target.value)}>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as QuestionKind)}>
            <option value="STANDARD">Standard</option>
            <option value="BOSS">Boss</option>
          </select>
        </label>
        <label>
          Difficulté
          <select value={form.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
            <option value={1}>1 — facile</option>
            <option value={2}>2 — moyen</option>
            <option value={3}>3 — difficile</option>
          </select>
        </label>
        <label>
          Chrono (s)
          <input
            type="number"
            min={5}
            max={120}
            value={form.timeLimitMs / 1000}
            onChange={(e) => set('timeLimitMs', Math.round(Number(e.target.value) * 1000))}
          />
        </label>
        <label>
          Points de base
          <input
            type="number"
            min={10}
            max={1000}
            value={form.basePoints}
            onChange={(e) => set('basePoints', Number(e.target.value))}
          />
        </label>
      </div>
      <label>
        Énoncé
        <textarea value={form.statement} onChange={(e) => set('statement', e.target.value)} rows={2} required />
      </label>
      <fieldset>
        <legend>Réponses (coche la bonne)</legend>
        {form.answers.map((a, i) => (
          <div key={a.id ?? `new-${i}`} className="answer-row">
            <input
              type="radio"
              name="correct"
              checked={a.isCorrect}
              onChange={() => setAnswer(i, { isCorrect: true })}
              aria-label={`Réponse ${i + 1} correcte`}
            />
            <input
              value={a.text}
              onChange={(e) => setAnswer(i, { text: e.target.value })}
              placeholder={`Réponse ${i + 1}`}
              required
            />
            <button
              type="button"
              className="btn btn--small btn--ghost"
              disabled={form.answers.length <= 3}
              onClick={() =>
                set(
                  'answers',
                  form.answers.filter((_, j) => j !== i),
                )
              }
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--small"
          disabled={form.answers.length >= 6}
          onClick={() => set('answers', [...form.answers, { text: '', isCorrect: false }])}
        >
          Ajouter une réponse
        </button>
      </fieldset>
      <label>
        Explication (affichée après la question)
        <textarea value={form.explanation} onChange={(e) => set('explanation', e.target.value)} rows={3} required />
      </label>
      <label>
        Lien MDN
        <input
          type="url"
          value={form.mdnUrl ?? ''}
          onChange={(e) => set('mdnUrl', e.target.value)}
          placeholder="https://developer.mozilla.org/…"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="menu-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Enregistrer
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
