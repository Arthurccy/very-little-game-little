import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { CreateSessionResponse, GameMode, SessionStateDTO, ThemeDTO } from '@fps/shared';
import { gameApi } from './api/endpoints';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { EndScreen } from './screens/EndScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { MenuScreen } from './screens/MenuScreen';

// La scène 3D et le back-office sont chargés à la demande.
const GameScreen = lazy(() => import('./game/GameScreen').then((m) => ({ default: m.GameScreen })));
const AdminScreen = lazy(() => import('./screens/admin/AdminScreen').then((m) => ({ default: m.AdminScreen })));

type Screen =
  | { name: 'menu' }
  | { name: 'game'; session: CreateSessionResponse }
  | { name: 'end'; session: SessionStateDTO }
  | { name: 'leaderboard' }
  | { name: 'admin' };

export function App() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [themes, setThemes] = useState<ThemeDTO[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<GameMode>('NORMAL');

  useEffect(() => {
    if (user) gameApi.themes().then(setThemes, () => setThemes([]));
    else setScreen({ name: 'menu' });
  }, [user]);

  const start = useCallback(async (mode: GameMode) => {
    setStarting(true);
    setError(null);
    setLastMode(mode);
    try {
      setScreen({ name: 'game', session: await gameApi.createSession(mode) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lancer la partie');
      setScreen({ name: 'menu' });
    } finally {
      setStarting(false);
    }
  }, []);

  if (loading) return <main className="panel panel--narrow">Chargement…</main>;
  if (!user) return <AuthScreen />;

  const menu = () => setScreen({ name: 'menu' });
  const fallback = <main className="panel panel--narrow">Chargement…</main>;

  switch (screen.name) {
    case 'game':
      return (
        <Suspense fallback={fallback}>
          <GameScreen
            key={screen.session.session.id}
            initial={screen.session}
            themes={themes}
            onEnded={(session) => setScreen({ name: 'end', session })}
          />
        </Suspense>
      );
    case 'end':
      return (
        <EndScreen
          session={screen.session}
          onReplay={() => void start(lastMode)}
          onLeaderboard={() => setScreen({ name: 'leaderboard' })}
          onMenu={menu}
        />
      );
    case 'leaderboard':
      return <LeaderboardScreen onBack={menu} />;
    case 'admin':
      return (
        <Suspense fallback={fallback}>
          <AdminScreen themes={themes} onBack={menu} />
        </Suspense>
      );
    default:
      return (
        <MenuScreen
          themes={themes}
          starting={starting}
          error={error}
          onStart={(mode) => void start(mode)}
          onLeaderboard={() => setScreen({ name: 'leaderboard' })}
          onAdmin={() => setScreen({ name: 'admin' })}
        />
      );
  }
}
