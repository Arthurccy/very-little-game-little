import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { MockDevToolbar } from './mocks/MockDevToolbar';
import './styles.css';

async function prepareApp() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
}

prepareApp().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
        {import.meta.env.DEV && <MockDevToolbar />}
      </AuthProvider>
    </StrictMode>,
  );
});
