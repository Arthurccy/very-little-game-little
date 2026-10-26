# very-little-game-little — FPS éducatif

Mini-FPS dans le navigateur pour réviser HTTP, REST, CORS, l’authentification, les failles web et le cache :
abats les mauvaises réponses, épargne la bonne.

**État : étape 1** — socle (monorepo, PostgreSQL, schéma Prisma, seed). Pas encore d’API ni de scène 3D.
Toute la conception est dans [`docs/conception.md`](docs/conception.md).

## Prérequis

- Node.js ≥ 20.19 et npm ≥ 10
- Docker (pour PostgreSQL uniquement)

## Démarrage

```bash
cp .env.example .env          # puis adapter les secrets et ADMIN_PASSWORD (12 caractères min.)
npm install                   # installe les 3 workspaces et génère le client Prisma
npm run db:up                 # PostgreSQL 16 sur localhost:54329
npm run db:migrate            # applique les migrations
npm run db:seed               # 6 thèmes, 66+ questions, compte admin
npm run dev:client            # écran d’attente sur http://localhost:43123
```

Le seed est rejouable : relancer `npm run db:seed` met à jour sans dupliquer.

## Scripts racine

| Script | Effet |
|---|---|
| `npm run db:up` / `db:down` | démarre / arrête le conteneur Postgres |
| `npm run db:migrate` | `prisma migrate dev` (ajouter `-- --name <nom>` pour une nouvelle migration) |
| `npm run db:seed` | exécute `server/prisma/seed.ts` |
| `npm run db:reset` | vide la base, rejoue migrations et seed |
| `npm run dev:client` | serveur Vite |
| `npm run typecheck` | `tsc` sur les trois workspaces |

## Structure

| Paquet | Rôle |
|---|---|
| `shared/` | DTO publics (jamais de `isCorrect`) et règles de score partagées |
| `server/` | Prisma : schéma, migrations, seed (API Express à l’étape 2) |
| `client/` | Vite + React + TypeScript (scène R3F à l’étape 3) |

Ports locaux : Postgres `54329`, API `43124`, Vite `43123`.
