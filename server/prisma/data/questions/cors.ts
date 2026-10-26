import { mdn, type SeedQuestionSet } from '../types.js';

export const corsQuestions: SeedQuestionSet = {
  themeSlug: 'cors',
  kind: 'STANDARD',
  questions: [
    {
      key: 'cors-origin-definition',
      statement: 'Qu’est-ce qui définit une « origine » au sens du navigateur ?',
      correct: 'Le triplet schéma, hôte et port',
      wrong: ['Le nom de domaine seul', 'L’adresse IP du serveur', 'Le chemin de l’URL'],
      explanation:
        'https://app.test:443 et http://app.test:80 sont deux origines distinctes. Le chemin n’entre pas en compte.',
      mdn: mdn('Glossary/Origin'),
      difficulty: 1,
    },
    {
      key: 'cors-who-enforces',
      statement: 'Qui applique la politique CORS ?',
      correct: 'Le navigateur, qui bloque la lecture de la réponse par le script',
      wrong: ['Le serveur, qui refuse d’exécuter la requête', 'Le pare-feu réseau', 'Le DNS'],
      explanation:
        'CORS n’est pas une protection du serveur : curl ou un autre serveur ignorent ces en-têtes. Le navigateur protège l’utilisateur.',
      mdn: mdn('Web/HTTP/CORS'),
      difficulty: 1,
    },
    {
      key: 'cors-wildcard-credentials',
      statement:
        'Une requête fetch avec credentials: "include" reçoit Access-Control-Allow-Origin: *. Que se passe-t-il ?',
      correct: 'Le navigateur bloque la réponse : le joker est interdit pour une requête avec identifiants',
      wrong: [
        'La réponse est lisible, le joker autorise tout',
        'Le navigateur retire les cookies et relance la requête',
        'Le serveur renvoie automatiquement une 401',
      ],
      explanation:
        'Avec identifiants, le serveur doit renvoyer l’origine exacte et Access-Control-Allow-Credentials: true.',
      mdn: mdn('Web/HTTP/CORS#requêtes_avec_informations_dauthentification'),
      difficulty: 2,
    },
    {
      key: 'cors-allow-credentials',
      statement: 'Quel en-tête de réponse autorise le script à lire une réponse obtenue avec cookies ?',
      correct: 'Access-Control-Allow-Credentials: true',
      wrong: ['Access-Control-Allow-Cookies: true', 'Access-Control-Expose-Headers: Cookie', 'Vary: Cookie'],
      explanation:
        'Sans Access-Control-Allow-Credentials: true (et une origine explicite), la réponse d’une requête « credentialed » reste illisible.',
      mdn: mdn('Web/HTTP/Headers/Access-Control-Allow-Credentials'),
      difficulty: 2,
    },
    {
      key: 'cors-preflight-trigger',
      statement: 'Laquelle de ces requêtes cross-origin déclenche un preflight OPTIONS ?',
      correct: 'Un POST avec Content-Type: application/json',
      wrong: [
        'Un GET sans en-tête personnalisé',
        'Un POST de formulaire en application/x-www-form-urlencoded',
        'Un HEAD sans en-tête personnalisé',
      ],
      explanation:
        'application/json ne fait pas partie des Content-Type « simples » (text/plain, multipart/form-data, x-www-form-urlencoded) : un preflight est requis.',
      mdn: mdn('Glossary/Preflight_request'),
      difficulty: 2,
    },
    {
      key: 'cors-max-age',
      statement: 'À quoi sert Access-Control-Max-Age ?',
      correct: 'Indiquer combien de temps le résultat du preflight peut être mis en cache',
      wrong: [
        'Limiter la durée de vie des cookies cross-origin',
        'Fixer le délai maximal de la requête principale',
        'Définir la durée du cache HTTP de la réponse',
      ],
      explanation:
        'Il évite de refaire un OPTIONS avant chaque requête. Le cache HTTP de la réponse relève de Cache-Control.',
      mdn: mdn('Web/HTTP/Headers/Access-Control-Max-Age'),
      difficulty: 2,
    },
    {
      key: 'cors-expose-headers',
      statement:
        'Le script ne parvient pas à lire l’en-tête X-Total-Count d’une réponse cross-origin. Quelle est la correction ?',
      correct: 'Ajouter Access-Control-Expose-Headers: X-Total-Count à la réponse',
      wrong: [
        'Ajouter Access-Control-Allow-Headers: X-Total-Count à la réponse',
        'Envoyer X-Total-Count dans la requête',
        'Passer mode: "no-cors" au fetch',
      ],
      explanation:
        'Allow-Headers concerne les en-têtes que le client peut ENVOYER. Expose-Headers liste ceux que le script peut LIRE.',
      mdn: mdn('Web/HTTP/Headers/Access-Control-Expose-Headers'),
      difficulty: 3,
    },
    {
      key: 'cors-no-cors-mode',
      statement: 'Que produit fetch(url, { mode: "no-cors" }) vers une autre origine ?',
      correct: 'Une réponse « opaque » dont le script ne peut lire ni le corps ni le statut',
      wrong: [
        'Une réponse lisible qui contourne CORS',
        'Une erreur immédiate sans requête réseau',
        'Une requête envoyée sans cookies mais lisible',
      ],
      explanation: 'no-cors ne contourne rien : il donne une réponse opaque, utile surtout pour les Service Workers.',
      mdn: mdn('Web/API/Request/mode'),
      difficulty: 3,
    },
    {
      key: 'cors-vary-origin',
      statement:
        'Le serveur renvoie Access-Control-Allow-Origin avec l’origine de la requête, choisie dans une liste. Quel en-tête ajouter pour les caches ?',
      correct: 'Vary: Origin',
      wrong: ['Cache-Control: public', 'Vary: Cookie', 'ETag'],
      explanation:
        'Sans Vary: Origin, un cache partagé peut servir à l’origine B une réponse qui autorise l’origine A.',
      mdn: mdn('Web/HTTP/Headers/Vary'),
      difficulty: 3,
    },
    {
      key: 'cors-not-csrf-protection',
      statement: 'CORS protège-t-il un formulaire POST cross-site contre le CSRF ?',
      correct:
        'Non : un formulaire simple est envoyé sans preflight, avec les cookies, même si la réponse est illisible',
      wrong: [
        'Oui, le navigateur bloque toute requête cross-origin',
        'Oui, si Access-Control-Allow-Origin n’est pas défini',
        'Non, mais uniquement pour les requêtes GET',
      ],
      explanation:
        'CORS restreint la lecture de la réponse, pas l’envoi des requêtes simples. Le CSRF se combat avec SameSite, jetons anti-CSRF et vérification de l’origine.',
      mdn: mdn('Glossary/CSRF'),
      difficulty: 2,
    },
  ],
};
