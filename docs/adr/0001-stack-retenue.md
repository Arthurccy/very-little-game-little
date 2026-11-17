# 0001 · Stack retenue

- Statut : accepté (17/11/2026)
- Décideurs : sous-groupes front et back, chacun relu par l'autre

Ce fichier ne se réécrit pas. Une décision qui remplace celle-ci reçoit un nouveau numéro,
et le statut ci-dessus devient « remplacé par 000N ».

## Contexte

Pan ! Mauvaise réponse est un FPS dans le navigateur. Six écrans : connexion, menu, partie,
fin, classement, back-office. Un minuteur. Pas de SEO, pas de SSR.

Le front (Arthur, Victor) porte le rendu. Le back (Clément, Mohamed) porte l'arbitrage, les
données et les secrets. Le client affiche. Le serveur tire les questions, chronomètre et
calcule PV, score, combo et bonus. La clé du hub Full-Stack Quest ne quitte pas le serveur.

Les deux sous-groupes connaissent déjà cette stack : elle fait tourner le jeu en local
(voir [`docs/conception.md`](../conception.md)).

## Décision

Pas de méta-framework.

- Front : React 19, Vite, TypeScript. Scène avec React Three Fiber et drei. HUD en HTML/CSS
  par-dessus le canvas. Les écrans sont un état local, sans routeur. Les données passent par
  le client HTTP typé depuis `contracts/openapi.yaml`. Les maquettes MSW restent hors du
  build de production.
- Back : Node.js, TypeScript, Express, Zod. PostgreSQL 16 et Prisma 6. Jetons avec `jose`,
  mots de passe avec Argon2id.
- Monorepo npm : `shared`, `server`, `client`, `e2e`. Docker Compose lance uniquement
  PostgreSQL. Le client et l'API tournent sur l'hôte.

## Conséquences

- Démarrage immédiat : la stack est celle du dépôt. Les tests sont déjà là (Vitest et
  Supertest pour l'API, Playwright pour le bout en bout).
- Le rechargement à chaud reste sur l'hôte. Seule la base passe par Docker.
- Le routage des écrans et le chargement des données sont assemblés dans le client.
- Three.js alourdit le paquet client. Le HUD reste dans le DOM, donc lisible.
- En local, deux processus (API et Vite) plus PostgreSQL.

## Alternatives écartées

- Vue + Nuxt, SvelteKit, Next.js. Méta-frameworks : le jeu n'a ni SEO ni SSR, et l'API doit
  rester un processus à part pour les secrets et l'arbitrage.
- TanStack Query. Le client a déjà un accès HTTP typé par le contrat. L'état d'une partie
  est une boucle calée sur l'horloge serveur, pas un cache de ressources.
- SQLite. PostgreSQL est déjà la source de vérité, migrée et seedée. Docker ne sert qu'à elle.
