import { mdn, type SeedQuestionSet } from '../types.js';

export const restQuestions: SeedQuestionSet = {
  themeSlug: 'rest',
  kind: 'STANDARD',
  questions: [
    {
      key: 'rest-post-not-idempotent',
      statement: 'Laquelle de ces méthodes n’est PAS idempotente ?',
      correct: 'POST',
      wrong: ['PUT', 'DELETE', 'GET'],
      explanation:
        'Répéter un POST peut créer plusieurs ressources. PUT remplace par la même représentation et DELETE supprime : répétés, ils laissent le même état.',
      mdn: mdn('Glossary/Idempotent'),
      difficulty: 1,
    },
    {
      key: 'rest-patch-idempotent',
      statement: 'Qu’affirme la spécification HTTP à propos de PATCH ?',
      correct: 'PATCH n’est pas garanti idempotent : cela dépend du format de modification',
      wrong: [
        'PATCH est toujours idempotent, comme PUT',
        'PATCH est une méthode sûre',
        'PATCH ne peut pas avoir de corps',
      ],
      explanation:
        'Un patch « incrémente le compteur » change l’état à chaque appel. Un patch « fixe le titre à X » l’est. La spec ne garantit donc rien.',
      mdn: mdn('Web/HTTP/Methods/PATCH'),
      difficulty: 2,
    },
    {
      key: 'rest-delete-twice',
      statement: 'On envoie deux fois DELETE /articles/42. En quoi DELETE reste-t-il idempotent ?',
      correct: 'L’état du serveur est le même après un ou deux appels, même si le second répond 404',
      wrong: [
        'Parce que le second appel doit obligatoirement répondre 204',
        'Parce que le serveur ignore les requêtes identiques',
        'Parce que DELETE ne modifie pas l’état du serveur',
      ],
      explanation:
        'L’idempotence porte sur l’effet sur l’état, pas sur le statut de la réponse. Un 404 au second appel est compatible.',
      mdn: mdn('Glossary/Idempotent'),
      difficulty: 2,
    },
    {
      key: 'rest-put-semantics',
      statement: 'Quelle est la sémantique de PUT /users/7 avec un corps JSON ?',
      correct: 'Remplacer (ou créer) la représentation complète de la ressource à cette URL',
      wrong: [
        'Ajouter un nouvel utilisateur à la collection avec un id généré',
        'Fusionner seulement les champs envoyés',
        'Lire l’utilisateur 7 en lui passant des filtres',
      ],
      explanation:
        'PUT remplace la ressource identifiée par l’URL. Créer dans une collection avec un id généré relève de POST, fusionner des champs de PATCH.',
      mdn: mdn('Web/HTTP/Methods/PUT'),
      difficulty: 1,
    },
    {
      key: 'rest-url-nouns',
      statement: 'Quelle URL respecte le mieux le style REST pour supprimer le commentaire 9 de l’article 3 ?',
      correct: 'DELETE /articles/3/comments/9',
      wrong: ['POST /deleteComment?id=9', 'GET /articles/3/comments/9/delete', 'DELETE /comments/delete/9'],
      explanation: 'En REST, l’URL nomme la ressource et la méthode HTTP porte l’action. Un GET ne doit jamais supprimer.',
      difficulty: 1,
    },
    {
      key: 'rest-get-side-effect',
      statement: 'Pourquoi ne faut-il jamais déclencher une suppression via un lien GET ?',
      correct: 'GET est une méthode sûre : robots, préchargements et caches peuvent l’appeler librement',
      wrong: [
        'Parce que GET ne peut pas transporter de paramètres',
        'Parce que GET est plus lent que POST',
        'Parce que les navigateurs bloquent les GET vers une API',
      ],
      explanation:
        'Crawlers, prefetch et proxies supposent que GET est sans effet. Un GET destructeur est aussi une cible CSRF triviale (une simple balise <img>).',
      mdn: mdn('Glossary/Safe/HTTP'),
      difficulty: 1,
    },
    {
      key: 'rest-idempotency-key',
      statement: 'Comment rendre un POST de paiement sûr face aux réessais réseau du client ?',
      correct: 'Envoyer une clé d’idempotence unique que le serveur mémorise et déduplique',
      wrong: [
        'Remplacer POST par GET',
        'Demander au client de ne jamais réessayer',
        'Ajouter Cache-Control: no-store à la requête',
      ],
      explanation:
        'Une clé d’idempotence (en-tête dédié, par ex. Idempotency-Key) permet au serveur de renvoyer le résultat déjà calculé au lieu de débiter deux fois.',
      difficulty: 3,
    },
    {
      key: 'rest-pagination',
      statement: 'Une collection compte un million d’éléments. Quelle approche est la plus raisonnable pour GET /orders ?',
      correct: 'Paginer (par curseur ou limit/offset) et renvoyer de quoi obtenir la page suivante',
      wrong: [
        'Renvoyer toujours la collection complète',
        'Répondre 413 Payload Too Large',
        'Imposer un POST /orders/search pour toute lecture',
      ],
      explanation:
        'La pagination borne la taille des réponses. 413 concerne un corps de requête trop gros envoyé par le client, pas la réponse.',
      difficulty: 1,
    },
    {
      key: 'rest-stateless',
      statement: 'Que signifie la contrainte « sans état » (stateless) de REST ?',
      correct: 'Chaque requête contient toute l’information nécessaire pour être comprise par le serveur',
      wrong: [
        'Le serveur ne doit stocker aucune donnée en base',
        'Les réponses ne doivent jamais être mises en cache',
        'Le client ne doit pas conserver d’état local',
      ],
      explanation:
        'Le serveur ne garde pas de contexte de conversation entre deux requêtes. Il peut évidemment persister les ressources elles-mêmes.',
      difficulty: 2,
    },
    {
      key: 'rest-content-negotiation',
      statement: 'Quel en-tête de requête indique au serveur les formats de réponse que le client accepte ?',
      correct: 'Accept',
      wrong: ['Content-Type', 'Accept-Encoding', 'Content-Language'],
      explanation:
        'Accept négocie le type de média de la réponse. Content-Type décrit le corps envoyé ; Accept-Encoding négocie la compression.',
      mdn: mdn('Web/HTTP/Headers/Accept'),
      difficulty: 1,
    },
    {
      key: 'rest-versioning-breaking',
      statement: 'Laquelle de ces modifications casse la compatibilité d’une API publique ?',
      correct: 'Renommer un champ existant de la réponse',
      wrong: [
        'Ajouter un champ optionnel à la réponse',
        'Ajouter un nouvel endpoint',
        'Accepter un paramètre de requête optionnel supplémentaire',
      ],
      explanation:
        'Les clients existants lisent l’ancien nom et ne le trouvent plus. Les ajouts optionnels sont rétrocompatibles si les clients ignorent l’inconnu.',
      difficulty: 2,
    },
  ],
};
