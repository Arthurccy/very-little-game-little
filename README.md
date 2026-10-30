# Pan ! Mauvaise réponse

> FPS éducatif dans le navigateur (dépôt `very-little-game-little`).

Mini-FPS dans le navigateur pour réviser HTTP, REST, CORS, l’authentification, les failles web et le cache :
chaque cible porte une réponse, **abats les mauvaises, épargne la bonne**.

- 6 zones thématiques de 4 questions, puis un boss final de 6 questions mélangées.
- 100 PV ; tirer sur la bonne réponse coûte 25 PV, laisser filer le chrono en coûte 20.
- Combo jusqu’à ×4, bonus de vitesse, bonus aléatoires (ralenti, réponse retirée, soin).
- Musique générée par zone, ennemis qui explosent et deviennent menaçants en fin de chrono, boss qui se fissure et riposte.
- Mode entraînement sans perte de PV, classement, back-office pour gérer les questions et voir les statistiques.
- Le serveur est seul arbitre : il tire les questions, chronomètre et calcule tout ; la bonne réponse ne quitte jamais l’API avant la fin de la question.

Toute la conception (règles, modèle, contrat d’API) est dans [`docs/conception.md`](docs/conception.md).

## Équipe

Projet de groupe (Ynov, année 2, front / back).

| Prénom   | Rôle  |
| -------- | ----- |
| Arthur   | Front |
| Victor   | Front |
| Clément  | Back  |
| Mohamed  | Back  |

Le front porte la scène 3D, le HUD et les écrans (menus, fin de partie, classement, back-office). Le back porte l’API,
l’authentification, les règles de partie et la base de données.

Le mode d'emploi du dépôt (contrat d'abord, frontière front/back, commits) est dans [`AGENTS.md`](AGENTS.md).
Il sert à l'équipe et aux assistants.

## Prérequis

- Node.js ≥ 20.19 et npm ≥ 10
- Docker (pour PostgreSQL uniquement)

## Démarrage

```bash
cp .env.example .env          # puis adapter JWT_ACCESS_SECRET et ADMIN_PASSWORD (12 caractères min.)
npm install                   # installe les 3 workspaces et génère le client Prisma
npm run db:up                 # PostgreSQL 16 sur localhost:54329
npm run db:migrate            # applique les migrations
npm run db:seed               # 6 thèmes, 71 questions, compte admin
npm run dev                   # API sur :43124 + client sur http://localhost:43123
```

Connecte-toi avec le compte admin du `.env` pour accéder au back-office, ou crée un compte joueur.

### Contrôles

| Action | Touche |
|---|---|
| Viser / tirer | souris / clic (après « Cliquer pour viser ») |
| Se déplacer | ZQSD ou WASD, flèches |
| Tirer directement sur la cible n | `1` à `6` |
| Couper le son | `M` |
| Couper la musique | `N` |
| Pause / reprise | `Échap` (ou `P` sans viser) : 3 pauses de 30 s max, chrono gelé, question masquée |

## Scripts racine

| Script | Effet |
|---|---|
| `npm run dev` | API (rechargement à chaud) et client Vite en parallèle |
| `npm run dev:server` / `dev:client` | l’un ou l’autre |
| `npm run dev:mock` | client seul, API simulée par MSW (aucun backend nécessaire) |
| `npm run generate:api` | régénère les types du front depuis `contracts/openapi.yaml` et `contracts/integration-v1.yaml` |
| `npm run play` | version optimisée (build de production du client) : la plus fluide pour jouer |
| `npm test` | tests d’intégration de l’API (base `<DATABASE_URL>_test`, créée et vidée automatiquement) |
| `npm run test:e2e` | tests de bout en bout Playwright : lance l’API et le client sur des ports dédiés, base `<DATABASE_URL>_e2e` |
| `npm run format` / `format:check` | formatage Prettier |
| `npm run typecheck` | `tsc` sur les trois workspaces |
| `npm run build:client` | build de production du client |
| `npm run db:up` / `db:down` | démarre / arrête le conteneur Postgres |
| `npm run db:migrate` | `prisma migrate dev` (ajouter `-- --name <nom>` pour une nouvelle migration) |
| `npm run db:seed` | rejoue le seed (rejouable sans doublons) |
| `npm run db:reset` | vide la base, rejoue migrations et seed |

## Front sans backend : maquettes MSW

```bash
npm install
npm run dev:mock              # client seul sur http://localhost:43123, API simulée par Mock Service Worker
```

- **Contrats** (`contracts/`) : `openapi.yaml` est le contrat de l’équipe (notre API, v0.2) ;
  `integration-v1.yaml` est le contrat du hub Full-Stack Quest (intervenant). Le front ne déclare aucun contrat à lui.
- **Types générés** : `npm run generate:api` produit `client/src/api/schema.d.ts` (depuis `openapi.yaml`) et
  `client/src/api/hub-schema.d.ts` (depuis `integration-v1.yaml`) ; ne pas les modifier à la main. Tout le front
  utilise ces types pour les données d’API (`shared` ne sert plus qu’aux règles de jeu).
- **v0.2 et serveur actuel** : le contrat pagine les listes et répond 422 aux erreurs de validation ; les maquettes
  suivent le contrat. En attendant que le serveur l’implémente, `client/src/api/endpoints.ts` accepte aussi l’ancien
  format (tableaux simples, 400) : une seule fonction, `asPage`, à retirer ensuite.
- **Relais du hub** : `POST /hub/link`, `GET /hub/me` et le champ `hub` du bilan ne sont pas encore dans le contrat
  de l’équipe ; ils sont proposés dans `client/src/api/hub-relay.ts`, à faire valider par le back.
- **Handlers** (`client/src/mocks/`) : un faux serveur en mémoire rejoue l’arbitrage réel (tirage, chrono, tirs,
  bonus, pause, classement, back-office) avec les 71 questions du seed. Chaque réponse est typée par le contrat.
- **Hub Full-Stack Quest** : le front lit `fsq_token` dans l’URL de lancement, le retire aussitôt de l’URL et ne le
  transmet qu’à notre back (`POST /hub/link`). Seul le back appelle le hub (`/api/v1/me`, `/api/v1/scores`) ; la clé
  `X-Game-Key` ne quitte jamais le serveur. En maquette, le panneau propose « Lancer depuis le hub » (jeton valide,
  bac à sable ou expiré) et les appels que notre back ferait au hub sont tracés dans la console.
- **Comptes de démo** : `joueur@demo.local` et `admin@demo.local`, mot de passe `motdepasse`.
- **Un cas d’erreur par écran**, à choisir dans le panneau « Maquettes MSW » (en bas à gauche) : connexion 401,
  lancement de partie 409, tirs 500, bilan 404, classement 500, back-office 422, jeton du hub refusé (422),
  hub indisponible (502) et réseau coupé.
- Le code des maquettes n’entre jamais dans le build de production.

## Tests et CI

- **API** (`server/test`, Vitest + Supertest) : authentification, arbitrage des tirs, bonus, pause, back-office.
- **Bout en bout** (`e2e/`, Playwright) : inscription et reprise de session, tirs rapides, pénalités, pause,
  entraînement, abandon, back-office. Première fois : `npx playwright install chromium` dans `e2e/`.
- **CI** (`.github/workflows/ci.yml`) : à chaque pull request et sur `main`, formatage, types, tests API,
  build du client et tests de bout en bout, chacun avec son PostgreSQL 16.

## Structure

| Paquet | Rôle |
|---|---|
| `shared/` | DTO publics (jamais de `isCorrect`) et règles de score partagées |
| `server/` | API Express + Prisma : auth JWT/refresh, arbitrage des parties, classement, back-office |
| `client/` | Vite + React + React Three Fiber : scène FPS, HUD, menus, back-office |
| `e2e/` | tests de bout en bout Playwright |

Ports locaux : Postgres `54329`, API `43124`, Vite `43123`. Si l’API annonce `EADDRINUSE`, le port est pris
(il est dans la plage éphémère de Linux) : change `API_PORT` et `VITE_API_URL` dans `.env`.
