import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';

/**
 * Mode maquette (`npm run dev:mock`) : Mock Service Worker simule l'API dans le navigateur.
 * Le code des maquettes est chargé à la demande et n'entre jamais dans le build de production.
 */
async function mockTools(): Promise<ReactNode> {
  if (import.meta.env.MODE !== 'mock') return null;
  const [{ startMocks }, { MockPanel }] = await Promise.all([import('./mocks/browser'), import('./mocks/MockPanel')]);
  await startMocks();
  return <MockPanel />;
}

void mockTools().then((panel) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
      {panel}
    </StrictMode>,
  );
});
