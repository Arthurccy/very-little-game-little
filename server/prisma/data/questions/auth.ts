import { mdn, type SeedQuestionSet } from '../types.js';

export const authQuestions: SeedQuestionSet = {
  themeSlug: 'auth',
  kind: 'STANDARD',
  questions: [
    {
      key: 'auth-jwt-payload-readable',
      statement: 'Le payload d’un JWT signé (JWS) est-il confidentiel ?',
      correct: 'Non : il est seulement encodé en base64url, n’importe qui peut le lire',
      wrong: [
        'Oui, la signature le chiffre',
        'Oui, seul le serveur possède la clé pour le décoder',
        'Seulement si l’algorithme est HS256',
      ],
      explanation: 'La signature garantit l’intégrité, pas la confidentialité. Ne jamais y mettre de secret.',
      difficulty: 1,
    },
    {
      key: 'auth-jwt-revocation',
      statement: 'Quel est l’inconvénient principal d’un JWT d’accès à longue durée de vie ?',
      correct: 'Il est difficile à révoquer avant son expiration sans état côté serveur',
      wrong: [
        'Il ne peut pas contenir l’identifiant de l’utilisateur',
        'Il ne fonctionne pas en HTTPS',
        'Il oblige à stocker le mot de passe côté client',
      ],
      explanation:
        'Un JWT est vérifié sans consulter la base : volé, il reste valable. D’où des jetons d’accès courts et un refresh token révocable.',
      difficulty: 2,
    },
    {
      key: 'auth-httponly',
      statement: 'Que garantit l’attribut HttpOnly sur un cookie ?',
      correct: 'Le cookie est inaccessible à JavaScript via document.cookie',
      wrong: [
        'Le cookie n’est envoyé qu’en HTTPS',
        'Le cookie n’est jamais envoyé en cross-site',
        'Le cookie est chiffré par le navigateur',
      ],
      explanation:
        'HttpOnly limite le vol de cookie par XSS. L’envoi en HTTPS seul est l’affaire de Secure, le cross-site de SameSite.',
      mdn: mdn('Web/HTTP/Cookies#restreindre_laccès_aux_cookies'),
      difficulty: 1,
    },
    {
      key: 'auth-samesite-lax',
      statement: 'Avec SameSite=Lax, quand un cookie est-il envoyé lors d’une requête venant d’un autre site ?',
      correct: 'Lors d’une navigation de premier niveau en GET (clic sur un lien)',
      wrong: [
        'Jamais',
        'Lors d’un POST de formulaire cross-site',
        'Lors d’un fetch cross-site avec credentials: "include"',
      ],
      explanation:
        'Lax bloque les sous-requêtes et POST cross-site, mais autorise la navigation GET de premier niveau. Strict bloque aussi celle-ci.',
      mdn: mdn('Web/HTTP/Headers/Set-Cookie#samesitesamesite-value'),
      difficulty: 2,
    },
    {
      key: 'auth-samesite-none-secure',
      statement: 'Que faut-il obligatoirement ajouter à un cookie SameSite=None pour que les navigateurs l’acceptent ?',
      correct: 'Secure',
      wrong: ['HttpOnly', 'Path=/', 'Max-Age'],
      explanation: 'Les navigateurs modernes rejettent un cookie SameSite=None qui n’est pas aussi Secure.',
      mdn: mdn('Web/HTTP/Headers/Set-Cookie'),
      difficulty: 2,
    },
    {
      key: 'auth-token-storage-xss',
      statement: 'Pourquoi éviter de stocker un jeton d’accès de longue durée dans localStorage ?',
      correct: 'Tout script injecté (XSS) sur la page peut le lire et l’exfiltrer',
      wrong: [
        'localStorage est vidé à chaque rechargement',
        'localStorage est envoyé automatiquement à chaque requête',
        'localStorage ne peut stocker que des nombres',
      ],
      explanation:
        'localStorage est lisible par tout JS de l’origine et persiste. Un jeton court en mémoire plus un refresh en cookie HttpOnly réduit l’exposition.',
      mdn: mdn('Web/API/Window/localStorage'),
      difficulty: 2,
    },
    {
      key: 'auth-cookie-csrf',
      statement: 'Une authentification par cookie de session expose à quelle attaque que le header Authorization: Bearer évite ?',
      correct: 'Le CSRF, car le navigateur joint le cookie automatiquement',
      wrong: ['Le XSS', 'L’injection SQL', 'Le clickjacking uniquement'],
      explanation:
        'Le cookie part tout seul avec la requête forgée. Un Bearer doit être ajouté explicitement par le script, ce qu’un site tiers ne peut pas faire.',
      mdn: mdn('Glossary/CSRF'),
      difficulty: 2,
    },
    {
      key: 'auth-password-hash',
      statement: 'Quelle méthode convient pour stocker des mots de passe ?',
      correct: 'Un hachage lent et salé dédié comme Argon2id ou bcrypt',
      wrong: ['SHA-256 sans sel', 'Un chiffrement AES réversible', 'Un encodage base64'],
      explanation:
        'Un hash rapide se brute-force à grande vitesse, un chiffrement se déchiffre si la clé fuit. Argon2id est lent et résistant aux GPU.',
      difficulty: 1,
    },
    {
      key: 'auth-alg-none',
      statement: 'Un serveur accepte un JWT dont l’en-tête indique "alg": "none". Quel est le risque ?',
      correct: 'Un attaquant peut forger un jeton non signé avec les droits de son choix',
      wrong: [
        'Aucun, le payload reste chiffré',
        'Le jeton expire immédiatement',
        'Le serveur ne peut plus lire le payload',
      ],
      explanation:
        'Le vérificateur doit imposer la liste des algorithmes attendus et refuser "none" — c’est ce que fait jose avec l’option algorithms.',
      difficulty: 3,
    },
    {
      key: 'auth-refresh-rotation',
      statement: 'Quel est l’intérêt de la rotation des refresh tokens ?',
      correct: 'Détecter la réutilisation d’un ancien jeton volé et révoquer toute la chaîne',
      wrong: [
        'Raccourcir le jeton d’accès',
        'Éviter d’utiliser HTTPS',
        'Permettre de stocker le refresh token dans l’URL',
      ],
      explanation:
        'Chaque refresh délivre un nouveau jeton et invalide l’ancien. Si un ancien revient, c’est un vol : on révoque la famille entière.',
      difficulty: 3,
    },
    {
      key: 'auth-cookie-path',
      statement: 'Pourquoi poser le refresh token avec Path=/auth ?',
      correct: 'Pour que le navigateur ne l’envoie qu’aux routes d’authentification',
      wrong: [
        'Pour le rendre illisible par JavaScript',
        'Pour qu’il expire à la fermeture de l’onglet',
        'Pour le chiffrer côté navigateur',
      ],
      explanation:
        'Path restreint les URL auxquelles le cookie est joint : moins d’envois, moins d’exposition. Ce n’est pas une frontière de sécurité contre le JS (c’est HttpOnly).',
      mdn: mdn('Web/HTTP/Cookies#portée_des_cookies'),
      difficulty: 2,
    },
  ],
};
