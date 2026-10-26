import { mdn, type SeedQuestionSet } from '../types.js';

export const httpQuestions: SeedQuestionSet = {
  themeSlug: 'http',
  kind: 'STANDARD',
  questions: [
    {
      key: 'http-401-vs-403',
      statement: 'Un utilisateur connecté demande une ressource réservée aux administrateurs. Quel statut renvoyer ?',
      correct: '403 Forbidden',
      wrong: ['401 Unauthorized', '404 Not Found', '400 Bad Request'],
      explanation:
        '401 signifie « identité inconnue ou invalide, authentifie-toi ». Ici l’identité est connue mais le rôle est insuffisant : c’est 403.',
      mdn: mdn('Web/HTTP/Status/403'),
      difficulty: 1,
    },
    {
      key: 'http-401-header',
      statement: 'Quel en-tête une réponse 401 doit-elle contenir selon la spécification HTTP ?',
      correct: 'WWW-Authenticate',
      wrong: ['Authorization', 'Set-Cookie', 'Location'],
      explanation:
        'Une réponse 401 doit indiquer au client comment s’authentifier via WWW-Authenticate. Authorization est un en-tête de requête, pas de réponse.',
      mdn: mdn('Web/HTTP/Headers/WWW-Authenticate'),
      difficulty: 2,
    },
    {
      key: 'http-safe-methods',
      statement: 'Laquelle de ces méthodes est « sûre » (sans effet de bord attendu côté serveur) ?',
      correct: 'HEAD',
      wrong: ['POST', 'PUT', 'DELETE'],
      explanation:
        'Les méthodes sûres sont GET, HEAD, OPTIONS et TRACE. PUT et DELETE sont idempotentes mais modifient l’état : elles ne sont pas sûres.',
      mdn: mdn('Glossary/Safe/HTTP'),
      difficulty: 1,
    },
    {
      key: 'http-201-location',
      statement: 'Après la création réussie d’une ressource via POST, quel statut est le plus adapté ?',
      correct: '201 Created',
      wrong: ['200 OK', '202 Accepted', '204 No Content'],
      explanation:
        '201 indique qu’une ressource a été créée ; l’en-tête Location peut pointer vers son URL. 202 signifie que le traitement est différé.',
      mdn: mdn('Web/HTTP/Status/201'),
      difficulty: 1,
    },
    {
      key: 'http-204',
      statement: 'Que signifie une réponse 204 No Content ?',
      correct: 'La requête a réussi et la réponse n’a volontairement pas de corps',
      wrong: [
        'La ressource demandée n’existe pas',
        'Le serveur n’a pas encore traité la requête',
        'Le client doit vider son cache',
      ],
      explanation: '204 est un succès sans corps, fréquent après un DELETE ou un PUT qui n’a rien à renvoyer.',
      mdn: mdn('Web/HTTP/Status/204'),
      difficulty: 1,
    },
    {
      key: 'http-301-vs-308',
      statement: 'Quelle redirection permanente garantit que la méthode et le corps (par ex. un POST) sont conservés ?',
      correct: '308 Permanent Redirect',
      wrong: ['301 Moved Permanently', '302 Found', '303 See Other'],
      explanation:
        'Avec 301 et 302, beaucoup de clients transforment historiquement un POST en GET. 308 (permanente) et 307 (temporaire) interdisent ce changement.',
      mdn: mdn('Web/HTTP/Status/308'),
      difficulty: 2,
    },
    {
      key: 'http-409',
      statement: 'Un client tente de créer un compte avec un email déjà utilisé. Quel statut décrit le mieux ce cas ?',
      correct: '409 Conflict',
      wrong: ['500 Internal Server Error', '401 Unauthorized', '405 Method Not Allowed'],
      explanation:
        '409 signale un conflit avec l’état actuel de la ressource. Une erreur 5xx accuserait à tort le serveur d’une panne.',
      mdn: mdn('Web/HTTP/Status/409'),
      difficulty: 2,
    },
    {
      key: 'http-405-allow',
      statement: 'Le serveur renvoie 405 Method Not Allowed. Quel en-tête doit accompagner cette réponse ?',
      correct: 'Allow',
      wrong: ['Accept', 'Access-Control-Allow-Methods', 'Content-Type'],
      explanation:
        'Allow liste les méthodes acceptées par la ressource. Access-Control-Allow-Methods ne concerne que la réponse à un preflight CORS.',
      mdn: mdn('Web/HTTP/Status/405'),
      difficulty: 2,
    },
    {
      key: 'http-422-vs-400',
      statement: 'Un JSON syntaxiquement invalide (accolade manquante) arrive sur l’API. Quel statut est le plus juste ?',
      correct: '400 Bad Request',
      wrong: ['415 Unsupported Media Type', '500 Internal Server Error', '406 Not Acceptable'],
      explanation:
        'Une requête mal formée relève de 400. 415 concerne un Content-Type non supporté, 406 une négociation (Accept) impossible.',
      mdn: mdn('Web/HTTP/Status/400'),
      difficulty: 2,
    },
    {
      key: 'http-429',
      statement: 'Un client dépasse la limite de requêtes autorisée. Quel statut renvoyer ?',
      correct: '429 Too Many Requests',
      wrong: ['403 Forbidden', '503 Service Unavailable', '408 Request Timeout'],
      explanation:
        '429 est dédié à la limitation de débit, idéalement avec Retry-After. 503 signale une indisponibilité du serveur, pas un abus du client.',
      mdn: mdn('Web/HTTP/Status/429'),
      difficulty: 1,
    },
    {
      key: 'http-options',
      statement: 'À quoi sert principalement la méthode OPTIONS ?',
      correct: 'Découvrir les capacités de communication d’une ressource (dont le preflight CORS)',
      wrong: [
        'Modifier partiellement une ressource',
        'Récupérer uniquement les en-têtes d’une ressource',
        'Ouvrir un tunnel vers un autre serveur',
      ],
      explanation:
        'OPTIONS décrit les options disponibles ; le navigateur s’en sert pour le preflight CORS. HEAD donne les en-têtes, PATCH modifie partiellement, CONNECT ouvre un tunnel.',
      mdn: mdn('Web/HTTP/Methods/OPTIONS'),
      difficulty: 1,
    },
  ],
};
