import type { SeedTheme } from './types.js';

export const themes: SeedTheme[] = [
  {
    slug: 'http',
    name: 'Méthodes et statuts HTTP',
    scenery: 'lobby',
    order: 1,
    intro: 'Le hall d’entrée : chaque requête porte une méthode, chaque réponse un statut. Apprends à lire les deux.',
  },
  {
    slug: 'rest',
    name: 'Conception d’API REST',
    scenery: 'warehouse',
    order: 2,
    intro: 'L’entrepôt des ressources : URL, idempotence et bons codes de retour.',
  },
  {
    slug: 'cors',
    name: 'Same-origin et CORS',
    scenery: 'border',
    order: 3,
    intro: 'Le poste-frontière du navigateur : qui a le droit de lire la réponse de qui ?',
  },
  {
    slug: 'auth',
    name: 'Authentification : JWT et cookies',
    scenery: 'vault',
    order: 4,
    intro: 'La salle des coffres : jetons, sessions et cookies, et ce que chacun protège vraiment.',
  },
  {
    slug: 'securite',
    name: 'Failles web : XSS, CSRF, injection',
    scenery: 'lab',
    order: 5,
    intro: 'Le laboratoire : les attaques classiques et les défenses qui tiennent.',
  },
  {
    slug: 'cache',
    name: 'Cache HTTP',
    scenery: 'datacenter',
    order: 6,
    intro: 'Le datacenter : Cache-Control, validateurs et requêtes conditionnelles.',
  },
];
