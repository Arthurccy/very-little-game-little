# 0002 · Stratégie de gestion d'état

- Statut : accepté (17/11/2026)
- Décideurs : sous-groupe front (Arthur, Victor), relu par le sous-groupe back (Clément, Mohamed)

Ce fichier ne se réécrit pas. Une décision qui remplace celle-ci reçoit un nouveau numéro,
et le statut ci-dessus devient « remplacé par 000N ».

## Contexte

Pan ! Mauvaise réponse alterne entre des écrans applicatifs simples (connexion, menu, classement,
back-office) et une boucle de jeu 3D en temps réel (déplacements, chronomètre, tirs, bonus).
L'API arbitre chaque action : la bonne réponse ne quitte jamais le serveur tant qu'une question
est ouverte.

La tentation classique est d'empiler une bibliothèque d'état global (Redux, Zustand) ou un cache
de requêtes (TanStack Query) pour tout le client. Ce cours rappelle qu'un état serveur copié dans
un store global devient une seconde source de vérité sans fraîcheur garantie.

## Décision

Quatre natures d'état, chacune traitée par l'outil le plus direct, sans dépendance externe superflue :

1. **État local** (`useState`, `useRef`, `useCallback`) :
   - Saisie des formulaires (connexion, questions du back-office).
   - États d'interface éphémères : écran courant (`currentScreen`), visée, cibles survolées.
   - File d'attente séquentielle des tirs (`queue` dans `useGame.ts`) avec exclusion mutuelle
     (`busy`) pour garantir qu'aucun tir rapide n'est perdu ni envoyé en double pendant la latence réseau.
2. **État global client** (React Context) :
   - Session utilisateur : `AuthContext` conserve en mémoire le jeton d'accès JWT, le pseudo et le rôle
     (`PLAYER` ou `ADMIN`). Le rafraîchissement passe par un cookie `httpOnly`.
   - Préférences du joueur : coupure du son (`audio.ts`) et de la musique (`music.ts`), basculables
     par touches clavier (`M`, `N`).
   - Maquettes : sélection du scénario d'erreur dans le panneau MSW en développement.
3. **État serveur** (requêtes HTTP à la demande) :
   - Classement (`/leaderboard`), thèmes (`/themes`), statistiques et questions admin (`/admin/questions`).
   - Appel direct via les fonctions typées d'`endpoints.ts` générées depuis `contracts/openapi.yaml`.
   - Pas de duplication dans un store global : chaque écran lit la donnée fraîche à l'ouverture avec
     pagination explicite (`asPage`).
4. **État temps réel de partie** (le serveur fait autorité) :
   - L'horloge serveur fait foi : `useGame` calcule un décalage fixe (`offsetRef = Date.parse(serverNow) - Date.now()`).
     L'échéance `endsAt` et les pauses `pauseEndsAt` sont dictées par le serveur ; le client ne décrémente
     jamais un compteur autoritaire.
   - Les points, le combo, les PV et le déclenchement des bonus sont calculés exclusivement par le serveur
     et retournés dans `ShotResponse`. La bonne réponse (`isCorrect`) n'est révélée qu'à la clôture.
5. **État URL** :
   - Le paramètre sensible `?fsq_token=<JWT>` est lu dès l'arrivée par `launch.ts`, transmis à notre
     backend (`POST /hub/link`), puis immédiatement nettoyé de la barre d'adresse (`history.replaceState`).

## Conséquences

- Zéro bibliothèque de gestion d'état ajoutée au bundle client (économise du poids et de la complexité).
- L'anti-triche est garanti par construction : le client ne possède aucun état métier qu'il pourrait falsifier.
- Les requêtes réseau en rafale lors de tirs rapides sont protégées contre les courses d'état grâce à la file locale.
- Les erreurs réseau et codes HTTP 4xx/5xx sont traités à la source (par écran et par appel).

## Alternatives écartées

- **Redux Toolkit** : cérémonial trop lourd (actions, reducers, sélecteurs) injustifié pour six écrans et une boucle FPS.
- **Zustand / Pinia** : séduisant pour du global léger, mais risquait d'encourager la recopie des réponses d'API dans un store client (anti-modèle de la slide 29).
- **TanStack Query** : pertinent pour une application orientée formulaires/listes, mais redondant ici : le jeu est une machine à états événementielle synchronisée à l'horloge serveur, pas une navigation entre collections de ressources cachables.
- **Chronomètre local décrémental** : rejeté car le décalage d'horloge entre machine joueur et serveur provoquerait des clôtures prématurées ou des litiges d'arbitrage.
