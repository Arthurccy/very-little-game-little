import { mdn, type SeedQuestionSet } from '../types.js';

export const securiteQuestions: SeedQuestionSet = {
  themeSlug: 'securite',
  kind: 'STANDARD',
  questions: [
    {
      key: 'sec-xss-definition',
      statement: 'Qu’est-ce qu’une faille XSS ?',
      correct: 'L’exécution de script injecté par un attaquant dans la page d’un autre utilisateur',
      wrong: [
        'L’envoi d’une requête forgée depuis un autre site avec les cookies de la victime',
        'L’injection de commandes SQL dans un formulaire',
        'L’affichage du site dans une iframe invisible',
      ],
      explanation:
        'Cross-Site Scripting : du code de l’attaquant s’exécute dans l’origine du site visé. Le second choix décrit le CSRF.',
      mdn: mdn('Glossary/Cross-site_scripting'),
      difficulty: 1,
    },
    {
      key: 'sec-xss-innerhtml',
      statement: 'Pour afficher un pseudo saisi par un utilisateur, quelle API DOM évite le XSS ?',
      correct: 'element.textContent = pseudo',
      wrong: ['element.innerHTML = pseudo', 'document.write(pseudo)', 'element.outerHTML = pseudo'],
      explanation:
        'textContent insère du texte brut, jamais interprété comme HTML. React fait de même par défaut, sauf avec dangerouslySetInnerHTML.',
      mdn: mdn('Web/API/Node/textContent'),
      difficulty: 1,
    },
    {
      key: 'sec-csp',
      statement: 'Quel mécanisme limite l’impact d’un XSS en restreignant les sources de scripts autorisées ?',
      correct: 'Content-Security-Policy',
      wrong: ['Strict-Transport-Security', 'Access-Control-Allow-Origin', 'X-Content-Type-Options'],
      explanation:
        'CSP (script-src, nonces, hashes) empêche l’exécution de scripts inline ou étrangers. HSTS force HTTPS, CORS gère la lecture cross-origin.',
      mdn: mdn('Web/HTTP/CSP'),
      difficulty: 2,
    },
    {
      key: 'sec-sql-injection',
      statement: 'Quelle est la défense principale contre l’injection SQL ?',
      correct: 'Les requêtes paramétrées (requêtes préparées)',
      wrong: ['Échapper les guillemets à la main', 'Masquer les messages d’erreur SQL', 'Utiliser POST au lieu de GET'],
      explanation:
        'Avec des paramètres liés, la donnée n’est jamais interprétée comme du SQL. L’échappement manuel est fragile ; masquer les erreurs ne corrige rien.',
      difficulty: 1,
    },
    {
      key: 'sec-csrf-token',
      statement: 'Comment fonctionne un jeton anti-CSRF ?',
      correct: 'Le serveur exige un secret imprévisible que seul le vrai site peut lire et renvoyer',
      wrong: ['Il chiffre le cookie de session', 'Il remplace HTTPS', 'Il empêche l’exécution de scripts inline'],
      explanation:
        'Le site attaquant peut provoquer l’envoi des cookies, mais pas lire le jeton (same-origin policy), donc pas le renvoyer.',
      mdn: mdn('Glossary/CSRF'),
      difficulty: 2,
    },
    {
      key: 'sec-clickjacking',
      statement: 'Quelle directive empêche un autre site d’afficher votre page dans une iframe (clickjacking) ?',
      correct: "Content-Security-Policy: frame-ancestors 'none'",
      wrong: ['X-XSS-Protection: 1', 'Referrer-Policy: no-referrer', 'Cross-Origin-Resource-Policy: same-site'],
      explanation:
        'frame-ancestors (ou l’ancien X-Frame-Options: DENY) interdit l’intégration. X-XSS-Protection est obsolète et sans rapport.',
      mdn: mdn('Web/HTTP/Headers/Content-Security-Policy/frame-ancestors'),
      difficulty: 2,
    },
    {
      key: 'sec-nosniff',
      statement: 'Que fait X-Content-Type-Options: nosniff ?',
      correct: 'Il interdit au navigateur de deviner un type MIME différent du Content-Type annoncé',
      wrong: [
        'Il empêche la mise en cache de la réponse',
        'Il bloque les requêtes cross-origin',
        'Il masque l’en-tête Server',
      ],
      explanation:
        'Sans nosniff, un fichier texte téléversé pourrait être interprété comme script. L’en-tête force le respect du Content-Type.',
      mdn: mdn('Web/HTTP/Headers/X-Content-Type-Options'),
      difficulty: 2,
    },
    {
      key: 'sec-client-validation',
      statement: 'Le formulaire valide déjà les champs en JavaScript. Faut-il revalider côté serveur ?',
      correct: 'Oui : toute requête peut être forgée sans passer par le formulaire',
      wrong: [
        'Non, la validation client suffit',
        'Seulement pour les champs de mot de passe',
        'Seulement si le site n’est pas en HTTPS',
      ],
      explanation:
        'La validation client sert l’ergonomie. La sécurité repose sur le serveur (ici Zod), qui ne fait confiance à rien.',
      difficulty: 1,
    },
    {
      key: 'sec-stored-xss',
      statement:
        'Un commentaire contenant <script> est enregistré puis affiché à tous les visiteurs. De quel type de XSS s’agit-il ?',
      correct: 'XSS stocké (persistant)',
      wrong: ['XSS réfléchi', 'CSRF', 'Injection SQL'],
      explanation:
        'Stocké : la charge vit en base et touche chaque lecteur. Réfléchi : elle revient dans la réponse à une URL piégée.',
      mdn: mdn('Glossary/Cross-site_scripting'),
      difficulty: 1,
    },
    {
      key: 'sec-hsts',
      statement:
        'Quel en-tête oblige le navigateur à n’utiliser que HTTPS pour un domaine lors des visites suivantes ?',
      correct: 'Strict-Transport-Security',
      wrong: ['Upgrade-Insecure-Requests', 'Content-Security-Policy: default-src https:', 'Secure'],
      explanation:
        'HSTS (avec max-age) empêche le downgrade en HTTP. Secure est un attribut de cookie, pas un en-tête de réponse.',
      mdn: mdn('Web/HTTP/Headers/Strict-Transport-Security'),
      difficulty: 2,
    },
    {
      key: 'sec-error-leak',
      statement: 'Que doit renvoyer une API en production quand une exception inattendue survient ?',
      correct: 'Un 500 avec un message générique, la trace étant consignée côté serveur',
      wrong: [
        'Un 500 avec la pile d’appels complète pour aider au débogage',
        'Un 200 avec un champ error',
        'Un 400 pour ne pas inquiéter le client',
      ],
      explanation:
        'Une stack trace divulgue chemins, versions et requêtes. Le statut doit rester honnête (5xx) et le détail aller dans les logs.',
      difficulty: 1,
    },
  ],
};
