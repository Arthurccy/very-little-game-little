# very-little-game-little

Mini-jeu FPS éducatif en français. Le joueur vise et élimine les mauvaises réponses d’une question ; toucher la bonne réponse, ou laisser le chrono arriver à zéro, coûte des points de vie et rate la question. Le serveur reste autoritaire : il tire la série de questions, mélange les réponses, n’envoie jamais la bonne réponse, et calcule lui-même PV, score, combo et bonus.

Une partie normale enchaîne des questions standard par thème, puis des questions boss mélangées sur tous les thèmes. Un mode entraînement rejoue la même validation, sans perte de PV et hors classement. Les questions portent sur les écarts classiques du web : codes HTTP, REST, CORS, JWT et cookies, XSS, CSRF, injection, cache.

## Équipe

Projet de groupe (Ynov, année 2, front / back).

| Prénom   | Rôle  |
| -------- | ----- |
| Arthur   | Front |
| Victor   | Front |
| Clément  | Back  |
| Mohamed  | Back  |

Le front porte la scène 3D, le HUD et les écrans (menus, fin de partie, classement, back-office). Le back porte l’API, l’authentification, les règles de partie et la base de données.

## Stack

- **Front** : Vite, React, TypeScript, React Three Fiber. Le HUD (question, PV, combo, explication) reste en HTML/CSS.
- **Back** : Node.js, TypeScript, Express, Zod, JWT (`jose`), mots de passe en Argon2id.
- **Données** : PostgreSQL 16 et Prisma. Docker Compose ne lance que la base.
- **Monorepo** : workspaces npm `shared`, `server` et `client`.

La conception détaillée (règles, schéma, contrat API) est dans [`mini-jeu-fps.md`](mini-jeu-fps.md).
