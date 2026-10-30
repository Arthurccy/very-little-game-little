import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Service worker MSW : intercepte les appels à l'API dans le navigateur (mode maquette). */
export const worker = setupWorker(...handlers);

export async function startMocks(): Promise<void> {
  await worker.start({
    // Les requêtes non couvertes (Vite, polices, assets) passent normalement, avec un avertissement
    // seulement si elles visent l'API.
    onUnhandledRequest(request, print) {
      if (request.url.includes('/auth/') || request.url.includes('/sessions') || request.url.includes('/admin/')) {
        print.warning();
      }
    },
  });
}
