# Contexte du dépôt

Mode d'emploi pour l'équipe et pour les assistants. Il résume les séances 1 à 3
(26, 27 et 30 octobre) tel que ce dépôt les applique.

Les règles de jeu, le modèle et le détail des routes sont dans
[`docs/conception.md`](docs/conception.md). On ne les recopie pas ici.

## Où lire quoi

| Question | Fichier |
| --- | --- |
| Démarrer le projet | [`README.md`](README.md) |
| Règles, modèle, parcours d'une partie | [`docs/conception.md`](docs/conception.md) |
| Promesse entre le front et le back | [`contracts/openapi.yaml`](contracts/openapi.yaml) |
| Promesse avec le hub Full-Stack Quest | [`contracts/integration-v1.yaml`](contracts/integration-v1.yaml) |
| Formes publiques et formules de score | `shared/src/dto.ts`, `shared/src/rules.ts` |

Le contrat décrit la jointure. Il ne décrit ni le framework, ni le schéma Prisma,
ni l'organisation des dossiers derrière cette jointure.

## Deux sous-groupes

| Sous-groupe | Personnes | Dossier | Ce qu'il porte |
| --- | --- | --- | --- |
| Front | Arthur, Victor | `client/` | Rendu, HUD, états d'écran (chargement, vide, erreur), accessibilité, performance perçue |
| Back | Clément, Mohamed | `server/` | Règles métier, source de vérité, validation, données, authentification, secrets, appels au hub |
| Les deux | — | `contracts/`, `shared/`, `docs/` | La jointure, relue des deux côtés |

- Le front ne modifie pas `server/`. Le back ne modifie pas `client/`. Un changement qui traverse la frontière passe par une pull request relue par l'autre sous-groupe.
- L'API est le canal officiel. Un champ qui n'y est pas écrit sera mal compris.
- Le client affiche. Le serveur arbitre : il tire les questions, chronomètre, et calcule PV, score, combo et bonus. `isCorrect` ne quitte pas l'API tant qu'une question de partie est ouverte.

## Le contrat d'abord

Dès que les deux sous-groupes partagent une route, la spec passe avant le code.
Une spec générée depuis le back décrit ce que le back a fait, pas ce dont le front a besoin.

1. La pull request ne touche que `contracts/openapi.yaml` (et, si besoin, `shared/`).
2. Le front et le back la relisent.
3. On la fusionne.
4. Chaque côté code ensuite, dans sa propre pull request, qui cite celle du contrat.

À la jointure, on est strict sur ce qu'on accepte et ouvert sur ce qu'on renvoie.

- Requête : `additionalProperties: false`, champs `required`, types, formats et bornes. Une propriété inconnue est un `422`, pas un champ ignoré. On ne corrige pas un `"42"` en `42`.
- Réponse : un champ ajouté plus tard ne casse pas le client.
- Erreurs : un seul format, `{ "error": { "code", "message", "details"? } }`. Le `code` est stable et sert aux programmes. Le `message` sert aux humains et peut changer.
- Chaque opération a un `operationId`, ses erreurs, et un exemple par cas d'écran (vide, verrouillé, erreur).
- Listes : page `{ items, limit, offset, total }`. Pas de coupure silencieuse.
- Le contrat n'expose pas le modèle interne (hash, schéma Prisma, `isCorrect` hors administration).

Ces écarts se règlent dans le YAML, pendant la relecture. Les retrouver au branchement coûte une demi-journée.

| Écart | Ce qui le tranche |
| --- | --- |
| Champ lu par le front, jamais envoyé | `required` explicite |
| `"42"` à la place de `42`, date sans fuseau | type et format (`date-time`, ISO 8601) |
| `null`, champ absent et `""` confondus | nullabilité écrite (`type: [string, "null"]`) |
| `200` avec une erreur dedans, ou du HTML sur un `500` | format d'erreur unique |
| Liste coupée sans le dire | pagination dans le contrat |
| Front bloqué en attendant la route | mocks dès que le contrat est fusionné |
| Champ renommé sans prévenir | pull request de contrat, `!` si c'est une rupture |

## Hub Full-Stack Quest

Le back du jeu est le back-for-front : il garde les secrets et appelle le hub pour le front.
Le contrat v1, c'est ces deux appels, rien d'autre (`contracts/integration-v1.yaml`).

1. Le hub ouvre le jeu avec `?fsq_token=<JWT>`.
2. Le front lit ce jeton et le transmet à **son** back. Il ne l'envoie pas au hub.
3. Le back appelle `GET /api/v1/me` pour savoir qui joue.
4. En fin de niveau, le back appelle `POST /api/v1/scores` avec le jeton **et** `X-Game-Key`.

- `X-Game-Key` reste dans l'environnement du serveur. Si elle apparaît dans le JavaScript livré, n'importe qui peut enregistrer un score.
- Le manifeste public est `GET /fsq-manifest.json` (`id` en minuscules et tirets, `contractVersion: "1.0"`).
- Erreurs du hub : `{ "error": { "code", "message" } }`. Débit : 60 requêtes par minute.
- Le jeton expire au bout de 2 heures et ne vaut que pour ce jeu.

## Branches et commits

Branches courtes sur `main` (GitHub Flow). Une branche qui vit une semaine est un contrat que personne n'a signé : le front et le back divergent, et le conflit de fusion n'est que le symptôme.

Personne ne pousse sur `main`. Une pull request, une relecture de l'autre sous-groupe, la CI verte. Fusion en squash : **le titre de la pull request est le message de commit**.

```text
<type>(<portée>): <description à l'impératif>
```

| | Valeurs |
| --- | --- |
| Types | `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `perf`, `chore` |
| Portées | `contract`, `client`, `server`, `shared`, `ci`, `docs` |

Une rupture se voit : `feat(contract)!: …` et un pied `BREAKING CHANGE: …`.
Une rupture de contrat passe par une pull request explicite, pas dans un correctif.

```text
feat(contract): ajouter le filtre de thème sur GET /leaderboard
fix(client): afficher l'erreur 422 sous le champ pseudo
feat(contract)!: renommer answerId en targetId dans ShotRequest
test(server): couvrir le jeton expiré sur POST /sessions
ci: lancer le lint du contrat sur chaque pull request
docs: préciser le trajet du fsq_token
```

`git log --oneline -- contracts/` doit se lire sans ouvrir les diffs.

## CI

À chaque pull request et sur `main`, `.github/workflows/ci.yml` enchaîne le formatage, les types, les tests d'API, le build du client, puis les tests de bout en bout. Si le contrat est invalide, le reste n'a pas à être construit.

## Pour un assistant

- Lire ce fichier et le contrat concerné avant de modifier une route, un écran ou un type partagé.
- Rester dans le dossier du sous-groupe demandé. `contracts/` et `shared/` se touchent seulement si le contrat change, et ce changement reste seul dans sa pull request.
- Ne pas inventer de champ, de code d'erreur, de route ou de secret. Si le contrat ne le dit pas, le proposer dans le contrat d'abord.
- Ne pas mettre `X-Game-Key`, `JWT_ACCESS_SECRET` ni un mot de passe dans `client/`.
- Le jeton d'accès du jeu reste en mémoire. Le refresh reste dans le cookie `httpOnly`.
- Écrire les textes joueur en français. Garder les identifiants de code en anglais, comme l'existant.
