# FPS éducatif — document de conception

Mini-FPS dans le navigateur pour réviser HTTP, REST, CORS, l’authentification, les failles web et le cache.
À chaque question, des cibles portent des réponses : le joueur abat les **mauvaises** et épargne la **bonne**.

Ce document fige les choix techniques, les règles de partie, le modèle de données et le contrat d’API.
L’étape 1 (ce dépôt) livre le socle : monorepo, PostgreSQL, schéma Prisma et seed. Le reste est décrit
ici et attend un feu vert explicite, dans l’ordre des étapes 2 à 7 (voir la [feuille de route](#feuille-de-route)).

---

## 1. Décisions techniques

| Domaine | Choix | Raison |
|---|---|---|
| Front (étape 3+) | Vite, React, TypeScript, React Three Fiber, drei | R3F reste du Three.js ; React sert les menus, la fin de partie, le classement et le back-office. |
| HUD | HTML/CSS par-dessus le canvas | Question, PV, combo, explication et menus sont plus simples et accessibles en DOM. |
| Visée | Pointer lock, raycast explicite depuis le centre de l’écran | Le tir est un événement discret envoyé au serveur ; aucune physique nécessaire. |
| Back | Node.js, TypeScript, Express, Zod | Validation déclarative des entrées, typage partagé. |
| Auth | `jose` (JWT HS256), Argon2id | `jose` impose la liste d’algorithmes (pas de `alg: none`) ; Argon2id est lent et résistant aux GPU. |
| Données | PostgreSQL 16, Prisma 6 | Migrations versionnées, client typé. |
| Infra locale | Docker Compose **uniquement pour Postgres** | Client et serveur tournent sur l’hôte pour garder le rechargement à chaud. |
| Monorepo | Workspaces npm : `shared`, `server`, `client` | `shared` porte les DTO publics et les règles de calcul. |
| Langue | Français (énoncés, HUD, seed) | Public cible. |

### Ports locaux (non standards pour éviter les collisions)

| Service | Port |
|---|---|
| PostgreSQL | `54329` |
| API Express | `43124` |
| Vite | `43123` |

### Principes anti-triche

Le client est un **affichage** ; le serveur est l’**arbitre**.

1. Le serveur tire la série de questions à la création de la partie et la persiste (`SessionQuestion`).
2. Il mélange les réponses par partie et persiste l’ordre (`SessionQuestion.answerOrder`).
3. Il n’envoie **jamais** `isCorrect` tant que la question est ouverte. Les DTO de `shared/src/dto.ts` n’ont pas ce champ, sauf `AdminQuestionDTO`, réservé au rôle `ADMIN`.
4. Il horodate lui-même le début de question (`startedAt`, `deadlineAt`) et mesure `elapsedMs` à réception du tir.
5. Il calcule seul PV, score, combo, multiplicateur et bonus.
6. L’avancée des ennemis à l’écran n’est qu’un **reflet du temps restant** : il n’y a pas de collision qui inflige des dégâts côté client.

---

## 2. Règles de partie

Les constantes et formules vivent dans `shared/src/rules.ts` ; le serveur les applique, le client ne fait que les afficher.

### Question

- Une question a **une** bonne réponse et **au moins deux** mauvaises (le seed en met trois).
- **Éliminer une mauvaise réponse** : la cible tombe, la question continue.
- **Succès** : toutes les mauvaises réponses sont éliminées avant l’échéance serveur.
- **Tirer sur la bonne réponse** : −25 PV, la question est **ratée** et close.
- **Chrono serveur à zéro** : −20 PV, la question est **ratée** et close.
- Une question close révèle la bonne réponse, l’explication et le lien MDN.

### Points, combo, multiplicateur

```
multiplicateur(combo) = min(4, 1 + combo × 0,25)
bonusVitesse          = 1 + 0,5 × (tempsRestant / tempsImparti)      ∈ [1 ; 1,5]
points                = round(basePoints × multiplicateur(comboAvant) × bonusVitesse)
```

- Le multiplicateur appliqué est celui du combo **avant** la réussite (la première réussite vaut × 1).
- Après une réussite, le combo monte d’un cran.
- Après un échec (bonne réponse touchée ou chrono échu), le combo retombe à 0 et le multiplicateur à 1.
- `tempsRestant` est calculé avec l’horloge serveur au moment du dernier tir valide.

### Déroulé d’une partie normale

- **PV de départ : 100.** À 0 PV, la partie est perdue (`LOST`).
- **Zones 1 à 6** : une par thème, dans l’ordre `Theme.order`. Le serveur tire **4 questions standard** par zone, au hasard dans un pool d’au moins 10.
- **Zone 7 — boss** : **6 questions boss**, tirées dans le pool `BOSS` et mélangées tous thèmes confondus.
- Soit 30 questions. L’ordre est persisté à la création ; la partie est gagnée (`WON`) si la 30ᵉ est close avec des PV restants.
- Le joueur peut abandonner (`POST /sessions/:id/end`) : statut `ABANDONED`, score conservé mais hors classement.

### Mode entraînement

Même tirage et même validation des tirs, mais **aucune perte de PV** et **hors classement**. Le score et le combo restent calculés pour le retour au joueur.

### Bonus (étape 6, déjà prévu au schéma)

- Le serveur décide du drop **au moment d’un tir valide** (élimination d’une mauvaise réponse) et l’inscrit dans `AnswerLog.bonus`.
- `SLOW_TIME` : repousse `deadlineAt` de la question en cours.
- `REMOVE_WRONG` : élimine une mauvaise réponse restante.
- `HEAL` : rend des PV, sans dépasser 100.

---

## 3. Modèle de données

Source : `server/prisma/schema.prisma`. Écarts par rapport au brouillon initial :

- **état de partie autoritaire** dans `GameSession` (PV, score, combo, multiplicateur, index courant) ;
- **série tirée d’avance** : `SessionQuestion` porte position, zone et ordre des réponses ;
- **pas de colonne `ordre` sur `Answer`** : l’ordre est propre à chaque partie ;
- **journal des tirs** (`AnswerLog`) avec un `elapsedMs` calculé par le serveur ;
- ajout de `RefreshToken` (stocké haché) pour la rotation et le logout ;
- ajout de `Question.seedKey` (seed rejouable) et `Question.isActive` (suppression douce au back-office).

```
User 1───* GameSession 1───* SessionQuestion *───1 Question *───1 Theme
  │                               │                   │
  └──* RefreshToken               └──* AnswerLog *──1 Answer *──┘ (Question 1──* Answer)
```

| Modèle | Champs clés |
|---|---|
| `User` | `pseudo` (unique), `email` (unique), `passwordHash` (Argon2id), `role` `PLAYER \| ADMIN` |
| `RefreshToken` | `tokenHash` (unique), `expiresAt`, `revokedAt`, `replacedBy` |
| `Theme` | `slug`, `name`, `scenery` (décor 3D), `order` (unique), `intro` |
| `Question` | `themeId`, `statement`, `explanation`, `mdnUrl`, `difficulty` 1–3, `kind` `STANDARD \| BOSS`, `timeLimitMs`, `basePoints`, `isActive`, `seedKey` |
| `Answer` | `questionId`, `text`, `isCorrect` |
| `GameSession` | `mode` `NORMAL \| TRAINING`, `status` `IN_PROGRESS \| WON \| LOST \| ABANDONED`, `score`, `hp`, `combo`, `multiplier`, `currentIndex`, `startedAt`, `endedAt` |
| `SessionQuestion` | `position` (unique par partie), `zone` (1–6 thèmes, 7 boss), `status` `PENDING \| ACTIVE \| CLEARED \| FAILED`, `answerOrder`, `startedAt`, `deadlineAt`, `resolvedAt`, `pointsAwarded` |
| `AnswerLog` | `answerId` (null pour un timeout), `outcome` `ELIMINATED_WRONG \| HIT_CORRECT \| TIMEOUT`, `elapsedMs`, `bonus` |

Choix de suppression : supprimer un utilisateur supprime ses parties ; une question jouée ne peut pas être supprimée physiquement (`Restrict`), on la désactive. Recréer les réponses d’une question (seed) passe les `AnswerLog.answerId` concernés à `null`.

### Seed

`server/prisma/seed.ts`, rejouable (upsert par `slug` et `seedKey`) :

- 6 thèmes : `http`, `rest`, `cors`, `auth`, `securite`, `cache` ;
- au moins 10 questions standard par thème (`server/prisma/data/questions/<thème>.ts`) ;
- 6 questions boss, une par thème (`boss.ts`), 15 s et 200 points de base ;
- un admin dont l’email, le pseudo et le mot de passe viennent de `ADMIN_EMAIL`, `ADMIN_PSEUDO`, `ADMIN_PASSWORD` ;
- validation avant écriture : clés uniques, ≥ 2 mauvaises réponses, pas de doublon, tailles de pool.

Les questions ciblent les confusions classiques : 401 vs 403, méthodes sûres vs idempotentes (POST, PATCH), CORS et requêtes « credentialed », JWT vs cookie, XSS/CSRF/injection, `no-cache` vs `no-store`, validateurs `ETag`/`Last-Modified`.

---

## 4. Contrat d’API (implémenté à l’étape 2)

Base : `http://localhost:43124`. JSON partout. Types dans `shared/src/dto.ts`.

### Authentification

| Route | Corps | Réponse |
|---|---|---|
| `POST /auth/register` | `RegisterRequest` | `201 AuthResponse` + cookie refresh |
| `POST /auth/login` | `LoginRequest` | `200 AuthResponse` + cookie refresh |
| `POST /auth/refresh` | — (cookie) | `200 AuthResponse`, rotation du refresh |
| `POST /auth/logout` | — (cookie) | `204`, refresh révoqué et cookie effacé |

- **Jeton d’accès** : JWT court (15 min), renvoyé dans le JSON, gardé **en mémoire** côté client, envoyé en `Authorization: Bearer`.
- **Refresh token** : opaque, cookie `httpOnly`, `SameSite=Lax`, `Path=/auth`, `Secure` en production. Stocké haché ; rotation à chaque refresh, réutilisation d’un jeton déjà remplacé = révocation de toute la chaîne.

### Jeu

| Route | Accès | Rôle |
|---|---|---|
| `GET /themes` | public | `ThemeDTO[]` triés par `order` |
| `POST /sessions` | joueur | `{ mode }` → crée la partie, tire la série, active la question 0 → `201 CreateSessionResponse` |
| `POST /sessions/:id/shots` | propriétaire | `{ answerId }` → valide le tir → `ShotResponse` |
| `POST /sessions/:id/timeout` | propriétaire | clôt la question active **si** `now ≥ deadlineAt` (sinon `409`) → `TimeoutResponse` |
| `POST /sessions/:id/end` | propriétaire | abandon → `EndSessionResponse` |
| `GET /leaderboard` | public | meilleures parties `NORMAL` terminées `WON`/`LOST` → `LeaderboardEntry[]` |
| `GET /stats/questions` | admin | taux de réussite et temps moyen par question → `QuestionStatDTO[]` |
| `GET/POST/PUT/DELETE /admin/questions` | admin | CRUD, `DELETE` = désactivation (`isActive = false`) |

Règles de `/shots` :

- `answerId` doit appartenir à la question **active** et ne pas être déjà éliminé, sinon `400`.
- Si l’horloge serveur a dépassé `deadlineAt`, le tir est traité comme un `TIMEOUT`.
- Les écritures d’un tir (log, question, session) se font dans **une transaction** avec verrou sur la session pour empêcher deux tirs concurrents de compter double.

### Erreurs

Format unique `ApiError` (`{ error: { code, message, details? } }`), géré par un middleware central :

| Statut | Code | Cas |
|---|---|---|
| 400 | `VALIDATION` | corps ou paramètres refusés par Zod |
| 401 | `UNAUTHENTICATED` | jeton absent, invalide ou expiré |
| 403 | `FORBIDDEN` | rôle insuffisant ou partie d’un autre joueur |
| 404 | `NOT_FOUND` | ressource inconnue |
| 409 | `CONFLICT` | pseudo/email déjà pris, timeout prématuré, partie déjà close |
| 500 | `INTERNAL` | message générique, détail dans les logs uniquement |

CORS limité à `CLIENT_ORIGIN` (origine exacte), `credentials: true`, `Vary: Origin`.

---

## 5. Arborescence

```text
package.json                 workspaces npm + scripts racine
tsconfig.base.json
docker-compose.yml           service postgres uniquement (port 54329)
.env.example
README.md
docs/
  conception.md              ce document
  plan-etape-1.md            brief de l’étape 1
shared/
  src/index.ts               réexports
  src/dto.ts                 types publics, sans isCorrect
  src/rules.ts               constantes et formules de score
server/
  prisma/schema.prisma
  prisma/migrations/         migrations versionnées
  prisma/seed.ts
  prisma/data/themes.ts
  prisma/data/types.ts
  prisma/data/questions/     un fichier par thème + boss.ts
client/
  index.html
  vite.config.ts             port 43123, .env lu à la racine
  src/main.tsx               écran d’attente, pas de scène 3D
```

À partir de l’étape 2, `server/src/` accueillera `app.ts`, `env.ts`, `routes/`, `services/` (tirage, arbitrage des tirs) et `middlewares/` (auth, erreurs).

---

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Spec, monorepo, Postgres, Prisma, seed | **livrée** |
| 2 | API Express : auth, thèmes, sessions, tirs, timeout, erreurs, CORS ; tests d’intégration | à valider |
| 3 | Scène FPS R3F : pointer lock, raycast, cibles-réponses, une zone | à valider |
| 4 | HUD complet, enchaînement des 6 zones, écran de fin | à valider |
| 5 | Boss jouable, sons | à valider |
| 6 | Bonus, mode entraînement côté client, classement | à valider |
| 7 | Back-office admin et statistiques | à valider |
