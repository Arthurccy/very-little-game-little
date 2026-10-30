import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiRequestError } from '../api/client';
import { hubApi } from '../api/endpoints';
import type { HubPlayer } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { clearLaunchToken, pendingLaunchToken } from './launch';

/**
 * - `idle` : partie lancée hors du hub ;
 * - `linking` : jeton en cours de vérification par notre back ;
 * - `linked` : joueur du hub associé, les scores lui seront envoyés par le back ;
 * - `invalid` : jeton refusé (invalide, expiré ou émis pour un autre jeu) ;
 * - `unavailable` : hub ou relais injoignable, nouvel essai possible.
 */
export type HubStatus = 'idle' | 'linking' | 'linked' | 'invalid' | 'unavailable';

interface HubState {
  status: HubStatus;
  player: HubPlayer | null;
  message: string | null;
  retry: () => void;
}

const HubContext = createContext<HubState | null>(null);

export function HubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<HubStatus>('idle');
  const [player, setPlayer] = useState<HubPlayer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) {
      setStatus('idle');
      setPlayer(null);
      setMessage(null);
      return;
    }
    let cancelled = false;
    const token = pendingLaunchToken();
    (async () => {
      if (token) {
        setStatus('linking');
        try {
          const link = await hubApi.link({ fsqToken: token });
          if (cancelled) return;
          clearLaunchToken();
          setPlayer(link.player);
          setStatus('linked');
          setMessage(null);
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiRequestError && (err.status === 422 || err.status === 400)) {
            // Jeton refusé par le hub : inutile de le renvoyer.
            clearLaunchToken();
            setStatus('invalid');
            setMessage('Lien du hub invalide ou expiré : relance le jeu depuis Full-Stack Quest.');
          } else {
            setStatus('unavailable');
            setMessage('Hub Full-Stack Quest injoignable : ton score ne pourra pas lui être envoyé.');
          }
        }
        return;
      }
      // Pas de nouveau jeton : le back a peut-être déjà un joueur du hub pour cette session.
      try {
        const link = await hubApi.me();
        if (cancelled) return;
        setPlayer(link.player);
        setStatus('linked');
      } catch {
        if (!cancelled) setStatus('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return <HubContext.Provider value={{ status, player, message, retry }}>{children}</HubContext.Provider>;
}

export function useHub(): HubState {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub doit être utilisé dans <HubProvider>');
  return ctx;
}
