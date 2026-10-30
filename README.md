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
