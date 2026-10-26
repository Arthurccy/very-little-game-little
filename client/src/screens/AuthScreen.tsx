import { useState, type FormEvent } from 'react';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login({ email, password });
      else await register({ pseudo, email, password });
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.details)) {
        setError((err.details as { message: string }[]).map((d) => d.message).join(' · '));
      } else {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="panel panel--narrow">
      <h1 className="title">FPS éducatif</h1>
      <p className="tagline">Élimine les mauvaises réponses. Épargne la bonne.</p>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
          Connexion
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
          Inscription
        </button>
      </div>

      <form className="form" onSubmit={submit}>
        {mode === 'register' && (
          <label>
            Pseudo
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              minLength={3}
              maxLength={32}
              required
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'register' ? 8 : 1}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </main>
  );
}
