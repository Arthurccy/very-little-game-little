import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@fps/shared';
import { refreshSession, setAccessToken, setSessionLostHandler } from '../api/client';
import { authApi } from '../api/endpoints';

interface AuthState {
  user: PublicUser | null;
  /** true tant que la reprise de session silencieuse (refresh au démarrage) n'est pas terminée. */
  loading: boolean;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));

    // Règle d'intégration Full-Stack Quest :
    // Le joueur arrive avec https://<notre-jeu>/?fsq_token=<JWT>
    const params = new URLSearchParams(window.location.search);
    const fsqToken = params.get('fsq_token');

    if (fsqToken) {
      // Nettoie l'URL sans recharger la page pour ne pas exposer le token dans l'historique
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      // Authentifie automatiquement le joueur auprès de notre backend
      authApi.fsqLogin(fsqToken)
        .then(accept)
        .catch((err) => {
          console.warn('[FSQ] Échec de la connexion via fsq_token, repli sur session locale :', err);
          return refreshSession().then((res) => res && setUser(res.user));
        })
        .finally(() => setLoading(false));
      return () => setSessionLostHandler(null);
    }

    refreshSession()
      .then((res) => res && setUser(res.user))
      .finally(() => setLoading(false));
    return () => setSessionLostHandler(null);
  }, [accept]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (body) => accept(await authApi.login(body)),
      register: async (body) => accept(await authApi.register(body)),
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, loading, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
