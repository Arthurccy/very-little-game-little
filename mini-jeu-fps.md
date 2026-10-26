---
name: FPS éducatif étape 1
overview: "Rédiger la spec corrigée en markdown, puis poser uniquement l’étape 1 : monorepo TypeScript, PostgreSQL via Docker Compose, schéma Prisma et seed français. Le jeu, l’API et la scène 3D restent pour après validation."
todos:
  - id: write-spec
    content: "Rédiger docs/conception.md (choix, règles, schéma, contrat API, arborescence)"
    status: pending
  - id: scaffold-workspaces
    content: "Créer les workspaces npm shared, server et client, plus .env.example et README"
    status: pending
  - id: prisma-seed
    content: "Écrire le schéma Prisma, Docker Compose Postgres, et le seed français (10+ questions par thème, boss, admin)"
    status: pending
isProject: false
---

# FPS éducatif — spec et étape 1

Le livrable de cette itération est un markdown de conception plus le socle exécutable (workspaces, Postgres, Prisma, seed). Aucune route de jeu, aucune scène Three.js.

## Décisions techniques

- **Front (plus tard)** : Vite, React, TypeScript, React Three Fiber et drei. Le HUD (question, PV, combo, explication, menus) reste en HTML/CSS. Pointer lock, visée et raycast restent explicites. R3F est Three.js, avec une UI React adaptée aux écrans de fin, au classement et au back-office.
- **Back** : Node.js, TypeScript, Express, Zod, `jose` pour les JWT, Argon2id pour les mots de passe.
- **Données** : PostgreSQL 16 et Prisma. Docker Compose ne lance que la base. Le client et le serveur tournent sur l’hôte pour garder le rechargement à chaud. Ports locaux non standards : Postgres `54329`, API `43124`, Vite `43123`.
- **Monorepo** : workspaces npm, trois paquets `shared`, `server`, `client`.
- **Langue du jeu** : français (énoncés, HUD, seed).
- **Anti-triche** : le serveur tire la série de questions à la création de partie, mélange les réponses, n’envoie jamais `isCorrect`, horodate lui-même le début de question, et calcule PV, score, combo et bonus. L’avancée des ennemis est un reflet du temps restant, pas une collision qui inflige des dégâts.

## Règles de partie (figées dans la spec)

- Une question a une bonne réponse et plusieurs mauvaises. Le joueur élimine les mauvaises. Tirer sur la bonne coûte 25 PV et rate la question. Le chrono serveur à zéro coûte 20 PV et rate la question. PV de départ : 100.
- Succès : toutes les mauvaises réponses sont touchées avant l’échéance. Points = `basePoints × multiplicateur × bonus de vitesse`. Le combo monte d’un cran ; le multiplicateur vaut `min(4, 1 + combo × 0,25)` et retombe à 1 après un échec.
- Une partie normale tire 4 questions standard par zone (pool d’au moins 10), puis 6 questions boss mélangées sur tous les thèmes. L’ordre est persisté. Le mode entraînement rejoue la même validation, sans perte de PV et hors classement.
- Bonus (plus tard, déjà prévu au schéma) : le serveur décide du drop au moment d’un tir valide. Effets : ralenti du chrono, retrait d’une mauvaise réponse, soin.

## Modèle Prisma

Écarts utiles par rapport au brouillon : état de partie autoritaire, série tirée d’avance, pas de colonne `ordre` sur les réponses, journal de tirs avec le temps calculé serveur.

- `User` : pseudo, email, `passwordHash`, rôle `PLAYER | ADMIN`.
- `Theme` : slug, nom, décor, `order`, courte intro.
- `Question` : thème, énoncé, explication, lien MDN, difficulté, `STANDARD | BOSS`, `timeLimitMs`, `basePoints`.
- `Answer` : texte, `isCorrect`.
- `GameSession` : mode `NORMAL | TRAINING`, statut, score, PV, combo, multiplicateur, index courant.
- `SessionQuestion` : position, zone, statut `PENDING | ACTIVE | CLEARED | FAILED`, dates, points.
- `AnswerLog` : tir, issue `ELIMINATED_WRONG | HIT_CORRECT | TIMEOUT`, `elapsedMs` serveur, bonus éventuel.

## Contrat API (documenté, implémenté à l’étape 2)

- Auth : `POST /auth/register`, `/login`, `/refresh`, `/logout`. Jeton d’accès dans le JSON (mémoire côté client). Refresh en cookie `httpOnly`, `SameSite=Lax`, `Path=/auth`.
- `GET /themes`.
- `POST /sessions` crée la partie et renvoie la première question (id de réponses + textes, sans le booléen).
- `POST /sessions/:id/shots` avec `{ answerId }` valide le tir.
- `POST /sessions/:id/timeout` clôt la question si l’horloge serveur est échue.
- `POST /sessions/:id/end`, `GET /leaderboard`, `GET /stats/questions`, CRUD `/admin/questions`.
- Erreurs centralisées : 400 validation, 401 anonyme, 403 rôle insuffisant, 404 inconnu. CORS limité à `CLIENT_ORIGIN`, `credentials: true`.

## Arborescence de l’étape 1

```text
package.json                 workspaces npm
docker-compose.yml           service postgres uniquement
.env.example
README.md
docs/conception.md           spec corrigée (le .md demandé)
shared/
  package.json
  src/index.ts               réexports
  src/dto.ts                 types publics, sans isCorrect
server/
  package.json
  tsconfig.json
  prisma/schema.prisma
  prisma/seed.ts
  prisma/data/themes.ts
  prisma/data/questions/     un fichier par thème + boss
client/
  package.json               coquille Vite + React + TS
  src/main.tsx               écran d’attente, pas de scène 3D
```

Le seed crée 6 thèmes, au moins 10 questions standard chacun, 6 questions boss, et un admin dont l’email et le mot de passe viennent de l’environnement. Les questions couvrent les écarts classiques : 401/403, méthodes REST non idempotentes, CORS et requêtes « credentialed », JWT vs cookie, XSS/CSRF/injection, `Cache-Control` et validateurs.

## Hors périmètre de cette itération

Routes Express, auth, scène FPS, HUD de jeu, boss jouable, sons, classement, back-office. Ces morceaux sont décrits dans `docs/conception.md` et attendent un feu vert explicite, dans l’ordre 2 → 7 du brief.
