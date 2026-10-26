import { mdn, type SeedQuestionSet } from '../types.js';

export const cacheQuestions: SeedQuestionSet = {
  themeSlug: 'cache',
  kind: 'STANDARD',
  questions: [
    {
      key: 'cache-no-cache-vs-no-store',
      statement: 'Que signifie Cache-Control: no-cache ?',
      correct: 'La réponse peut être stockée, mais doit être revalidée auprès du serveur avant chaque réutilisation',
      wrong: [
        'La réponse ne doit jamais être stockée',
        'La réponse expire après une heure',
        'Seuls les caches partagés peuvent la conserver',
      ],
      explanation:
        'Piège classique : c’est no-store qui interdit le stockage. no-cache impose seulement la revalidation.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#no-cache'),
      difficulty: 2,
    },
    {
      key: 'cache-no-store',
      statement: 'Quelle directive utiliser pour une réponse contenant des données bancaires personnelles ?',
      correct: 'Cache-Control: no-store',
      wrong: ['Cache-Control: no-cache', 'Cache-Control: public, max-age=60', 'Pragma: public'],
      explanation: 'no-store interdit tout stockage, dans le navigateur comme dans les caches intermédiaires.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#no-store'),
      difficulty: 1,
    },
    {
      key: 'cache-private',
      statement: 'Que signifie Cache-Control: private ?',
      correct: 'Seul le cache du navigateur peut stocker la réponse, pas un CDN ni un proxy partagé',
      wrong: [
        'La réponse ne peut être lue qu’en HTTPS',
        'La réponse ne doit pas être stockée du tout',
        'La réponse est chiffrée dans le cache',
      ],
      explanation: 'private exclut les caches partagés, utile pour une réponse propre à un utilisateur.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#private'),
      difficulty: 1,
    },
    {
      key: 'cache-etag-304',
      statement:
        'Le client envoie If-None-Match avec l’ETag qu’il possède et la ressource n’a pas changé. Que répond le serveur ?',
      correct: '304 Not Modified, sans corps',
      wrong: ['200 OK avec le corps complet', '204 No Content', '412 Precondition Failed'],
      explanation:
        '304 dit au client de réutiliser sa copie. 412 sert aux préconditions qui échouent, par exemple If-Match lors d’une écriture.',
      mdn: mdn('Web/HTTP/Status/304'),
      difficulty: 1,
    },
    {
      key: 'cache-last-modified',
      statement: 'Quel en-tête de requête accompagne le validateur Last-Modified lors d’une revalidation ?',
      correct: 'If-Modified-Since',
      wrong: ['If-None-Match', 'If-Unmodified-Since', 'If-Range'],
      explanation:
        'If-Modified-Since rejoue la date ; If-None-Match rejoue l’ETag. If-Unmodified-Since protège plutôt des écritures concurrentes.',
      mdn: mdn('Web/HTTP/Headers/If-Modified-Since'),
      difficulty: 2,
    },
    {
      key: 'cache-if-match-lost-update',
      statement: 'Comment éviter qu’un PUT écrase la modification d’un autre client faite entre-temps ?',
      correct: 'Envoyer If-Match avec l’ETag lu : le serveur répond 412 si la ressource a changé',
      wrong: [
        'Envoyer Cache-Control: no-cache dans la requête',
        'Utiliser POST au lieu de PUT',
        'Envoyer If-None-Match: *',
      ],
      explanation:
        'If-Match implémente un verrou optimiste. If-None-Match: * sert à l’inverse : ne créer que si la ressource n’existe pas.',
      mdn: mdn('Web/HTTP/Headers/If-Match'),
      difficulty: 3,
    },
    {
      key: 'cache-s-maxage',
      statement: 'Quelle directive fixe une durée de fraîcheur propre aux caches partagés (CDN) ?',
      correct: 's-maxage',
      wrong: ['max-stale', 'min-fresh', 'stale-if-error'],
      explanation:
        's-maxage prime sur max-age pour les caches partagés. max-stale et min-fresh sont des directives de requête.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#s-maxage'),
      difficulty: 2,
    },
    {
      key: 'cache-immutable-fingerprint',
      statement: 'Pour un fichier app.3f9a1c.js dont le nom change à chaque build, quelle politique est adaptée ?',
      correct: 'Cache-Control: public, max-age=31536000, immutable',
      wrong: ['Cache-Control: no-store', 'Cache-Control: no-cache', 'Expires: 0'],
      explanation:
        'Le nom empreinté garantit qu’un contenu nouveau a une nouvelle URL : on peut le garder un an sans revalider.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#immutable'),
      difficulty: 2,
    },
    {
      key: 'cache-vary',
      statement: 'Une même URL renvoie du JSON ou du HTML selon l’en-tête Accept. Que faut-il ajouter ?',
      correct: 'Vary: Accept',
      wrong: ['Cache-Control: private', 'Content-Location', 'ETag: W/"json"'],
      explanation: 'Vary indique aux caches quels en-têtes de requête font partie de la clé de cache.',
      mdn: mdn('Web/HTTP/Headers/Vary'),
      difficulty: 2,
    },
    {
      key: 'cache-weak-etag',
      statement: 'Que signifie le préfixe W/ dans ETag: W/"abc" ?',
      correct: 'Un validateur faible : les représentations sont équivalentes, pas forcément identiques octet par octet',
      wrong: [
        'L’ETag est chiffré',
        'La ressource est en écriture seule',
        'L’ETag n’est valable que pour les requêtes WebSocket',
      ],
      explanation:
        'Un ETag faible tolère des différences mineures (compression, espaces). Il ne convient pas aux requêtes de plage (Range).',
      mdn: mdn('Web/HTTP/Headers/ETag'),
      difficulty: 3,
    },
    {
      key: 'cache-stale-while-revalidate',
      statement: 'Que permet la directive stale-while-revalidate=60 ?',
      correct: 'Servir une copie périmée pendant 60 s tout en la revalidant en arrière-plan',
      wrong: [
        'Revalider toutes les 60 secondes même si la copie est fraîche',
        'Interdire le cache pendant 60 secondes',
        'Servir une copie périmée uniquement si le serveur répond 5xx',
      ],
      explanation:
        'L’utilisateur obtient une réponse immédiate et la copie est rafraîchie en tâche de fond. Le dernier choix décrit stale-if-error.',
      mdn: mdn('Web/HTTP/Headers/Cache-Control#stale-while-revalidate'),
      difficulty: 3,
    },
  ],
};
