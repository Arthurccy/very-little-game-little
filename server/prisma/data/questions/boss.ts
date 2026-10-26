import { mdn, type SeedQuestion, type SeedQuestionSet } from '../types.js';

/** Questions du boss : plus difficiles, chrono plus court, plus de points. Une par thème au minimum. */
const BOSS_DEFAULTS = { difficulty: 3, timeLimitMs: 15000, basePoints: 200 } as const;

const boss = (themeSlug: string, questions: SeedQuestion[]): SeedQuestionSet => ({
  themeSlug,
  kind: 'BOSS',
  questions: questions.map((q) => ({ ...BOSS_DEFAULTS, ...q })),
});

export const bossQuestions: SeedQuestionSet[] = [
  boss('http', [
    {
      key: 'boss-http-401-expired-token',
      statement:
        'Un jeton d’accès expiré arrive sur une route protégée. Quel statut permet au client de comprendre qu’il doit rafraîchir sa session ?',
      correct: '401 Unauthorized',
      wrong: ['403 Forbidden', '419 Session Expired', '440 Login Time-out'],
      explanation:
        'L’identité n’est plus prouvée : c’est 401. 403 inciterait le client à abandonner. 419 et 440 ne sont pas des statuts HTTP standard.',
      mdn: mdn('Web/HTTP/Status/401'),
    },
  ]),
  boss('rest', [
    {
      key: 'boss-rest-retry-safe',
      statement: 'Un proxy peut rejouer automatiquement une requête après une coupure. Laquelle peut-il rejouer sans risque ?',
      correct: 'PUT /profile avec la représentation complète',
      wrong: ['POST /orders', 'PATCH /counter avec {"op":"increment"}', 'POST /payments'],
      explanation:
        'Seules les méthodes idempotentes se rejouent sans changer le résultat. PUT complet l’est ; POST et un PATCH d’incrément ne le sont pas.',
      mdn: mdn('Glossary/Idempotent'),
    },
  ]),
  boss('cors', [
    {
      key: 'boss-cors-credentialed-config',
      statement:
        'Le client sur http://localhost:43123 appelle l’API avec credentials: "include". Quelle réponse de l’API fonctionne ?',
      correct: 'Access-Control-Allow-Origin: http://localhost:43123 et Access-Control-Allow-Credentials: true',
      wrong: [
        'Access-Control-Allow-Origin: * et Access-Control-Allow-Credentials: true',
        'Access-Control-Allow-Origin: localhost et Access-Control-Allow-Credentials: true',
        'Access-Control-Allow-Origin: http://localhost:43123 sans autre en-tête',
      ],
      explanation:
        'Avec identifiants, il faut l’origine exacte (schéma, hôte et port) ET Allow-Credentials: true. Le joker est refusé.',
      mdn: mdn('Web/HTTP/CORS'),
    },
  ]),
  boss('auth', [
    {
      key: 'boss-auth-storage-design',
      statement: 'Quelle combinaison limite le mieux à la fois le vol de jeton par XSS et le CSRF ?',
      correct: 'Jeton d’accès court en mémoire (Bearer) et refresh token en cookie HttpOnly, SameSite, Path restreint',
      wrong: [
        'Jeton d’accès de 30 jours dans localStorage',
        'Jeton d’accès en cookie lisible par JavaScript, SameSite=None',
        'Refresh token dans sessionStorage et jeton d’accès dans l’URL',
      ],
      explanation:
        'En mémoire, le jeton d’accès disparaît au rechargement et n’est pas joint automatiquement (pas de CSRF). Le refresh, HttpOnly, échappe au JS.',
    },
  ]),
  boss('securite', [
    {
      key: 'boss-sec-csrf-defenses',
      statement: 'Laquelle de ces mesures NE protège PAS contre le CSRF ?',
      correct: 'Activer HttpOnly sur le cookie de session',
      wrong: [
        'Poser le cookie avec SameSite=Lax ou Strict',
        'Exiger un jeton anti-CSRF dans chaque requête qui modifie l’état',
        'Vérifier l’en-tête Origin des requêtes qui modifient l’état',
      ],
      explanation:
        'HttpOnly empêche JavaScript de lire le cookie, mais le navigateur continue de l’envoyer avec la requête forgée.',
      mdn: mdn('Glossary/CSRF'),
    },
  ]),
  boss('cache', [
    {
      key: 'boss-cache-user-data-cdn',
      statement:
        'GET /me renvoie le profil de l’utilisateur connecté et passe par un CDN. Quelle politique évite de servir le profil d’Alice à Bob ?',
      correct: 'Cache-Control: private, no-cache',
      wrong: ['Cache-Control: public, max-age=300', 'Cache-Control: s-maxage=60', 'ETag seul, sans Cache-Control'],
      explanation:
        'private interdit le stockage par le CDN ; no-cache force la revalidation dans le navigateur. Un ETag seul ne dit pas qui a le droit de stocker la réponse.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control'),
    },
  ]),
];
