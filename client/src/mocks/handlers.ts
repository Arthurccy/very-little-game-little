import { http, HttpResponse } from 'msw';
import type { components } from '../api/schema';

// Types générés directement depuis contracts/openapi.yaml via openapi-typescript
type AuthResponse = components['schemas']['AuthResponse'];
type ApiError = components['schemas']['ApiError'];
type Theme = components['schemas']['Theme'];
type CreateSessionResponse = components['schemas']['CreateSessionResponse'];
type ShotResponse = components['schemas']['ShotResponse'];
type SessionDetail = components['schemas']['SessionDetail'];
type PublicQuestion = components['schemas']['PublicQuestion'];

// État mutable du simulateur d'erreurs pour la démo intervenant
export const mockErrorState = {
  authError: false,   // Écran 1 : 401 UNAUTHENTICATED sur /auth/login
  themesError: false, // Écran 2 : 500 INTERNAL sur /themes
  gameError: false,   // Écran 3 : 409 CONFLICT sur les tirs de jeu
};

// Exposer globalement pour débuggage rapide en console si besoin
if (typeof window !== 'undefined') {
  (window as unknown as { __MOCK_ERROR_STATE__: typeof mockErrorState }).__MOCK_ERROR_STATE__ = mockErrorState;
}

// État de session de jeu mocké
let currentHp = 100;
let currentScore = 0;
let currentCombo = 0;
let isPaused = false;
let eliminatedIds: string[] = [];
let isLoggedIn = false;

export const handlers = [
  // =========================================================================
  // ÉCRAN 1 : AUTHENTIFICATION (Connexion / Inscription / Session)
  // =========================================================================
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    // CAS D'ERREUR ÉCRAN 1 : Toggle actif ou mot de passe "error"
    if (mockErrorState.authError || body.password === 'error' || body.email === 'error@example.com') {
      const errorPayload: ApiError = {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Identifiants invalides (Simulation erreur 401 MSW)',
        },
      };
      return HttpResponse.json(errorPayload, { status: 401 });
    }

    // SUCCÈS ÉCRAN 1
    isLoggedIn = true;
    const successPayload: AuthResponse = {
      accessToken: 'msw_jwt_mock_token_level_1',
      user: {
        id: 'u_mock_player',
        pseudo: body.email?.split('@')[0] || 'JoueurNiveau1',
        role: 'PLAYER',
      },
    };
    return HttpResponse.json(successPayload, { status: 200 });
  }),

  http.post('*/auth/register', async ({ request }) => {
    const body = (await request.json()) as { pseudo?: string; email?: string; password?: string };
    if (mockErrorState.authError || body.password === 'error') {
      const errorPayload: ApiError = {
        error: {
          code: 'VALIDATION',
          message: 'Données d’inscription invalides (Simulation 422 MSW)',
        },
      };
      return HttpResponse.json(errorPayload, { status: 422 });
    }

    isLoggedIn = true;
    const successPayload: AuthResponse = {
      accessToken: 'msw_jwt_mock_token_level_1',
      user: {
        id: 'u_mock_player',
        pseudo: body.pseudo || 'NouveauJoueur',
        role: 'PLAYER',
      },
    };
    return HttpResponse.json(successPayload, { status: 200 });
  }),

  // Au démarrage, AuthContext tente un refresh. Si non connecté, renvoie 401 pour afficher l'AuthScreen
  http.post('*/auth/refresh', () => {
    if (!isLoggedIn) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Aucune session active' } },
        { status: 401 },
      );
    }
    const refreshPayload: AuthResponse = {
      accessToken: 'msw_jwt_refreshed_token',
      user: {
        id: 'u_mock_player',
        pseudo: 'JoueurNiveau1',
        role: 'PLAYER',
      },
    };
    return HttpResponse.json(refreshPayload, { status: 200 });
  }),

  http.post('*/auth/logout', () => {
    isLoggedIn = false;
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  // =========================================================================
  // ÉCRAN 2 : MENU PRINCIPAL (Thèmes & Niveau 1 Zone 1 HTTP)
  // =========================================================================
  http.get('*/themes', () => {
    // CAS D'ERREUR ÉCRAN 2 : Simulation crash 500
    if (mockErrorState.themesError) {
      const errorPayload: ApiError = {
        error: {
          code: 'INTERNAL',
          message: 'Erreur interne lors du chargement des thèmes (Simulation erreur 500 MSW)',
        },
      };
      return HttpResponse.json(errorPayload, { status: 500 });
    }

    // SUCCÈS ÉCRAN 2 : Données conformes au contrat OpenAPI
    const themesPayload: Theme[] = [
      {
        id: 'theme_http_zone_1',
        slug: 'http',
        name: 'Zone 1 — Protocole HTTP',
        order: 1,
        scenery: 'DATA_CENTER',
        intro: 'Maîtrisez les requêtes, en-têtes et statuts HTTP essentiels.',
      },
      {
        id: 'theme_rest_zone_2',
        slug: 'rest',
        name: 'Zone 2 — Architecture REST',
        order: 2,
        scenery: 'OFFICE',
        intro: 'Concevez des ressources idempotentes et prévisibles.',
      },
      {
        id: 'theme_sec_zone_3',
        slug: 'security',
        name: 'Zone 3 — Sécurité Web & Auth',
        order: 3,
        scenery: 'LAB',
        intro: 'Protégez vos endpoints contre les failles courantes.',
      },
    ];
    return HttpResponse.json(themesPayload, { status: 200 });
  }),

  http.get('*/leaderboard', () => {
    return HttpResponse.json([
      { rank: 1, pseudo: 'Alice', score: 3450, endedAt: new Date().toISOString() },
      { rank: 2, pseudo: 'Bob', score: 2800, endedAt: new Date().toISOString() },
      { rank: 3, pseudo: 'JoueurNiveau1', score: 2100, endedAt: new Date().toISOString() },
    ], { status: 200 });
  }),

  // =========================================================================
  // ÉCRAN 3 : JEU — NIVEAU 1 (Zone 1 HTTP)
  // =========================================================================
  http.post('*/sessions', async () => {
    currentHp = 100;
    currentScore = 0;
    currentCombo = 0;
    isPaused = false;
    eliminatedIds = [];

    const now = new Date();
    const startedAt = new Date(now.getTime() + 1000).toISOString();
    const deadlineAt = new Date(now.getTime() + 30000).toISOString();

    const question1: PublicQuestion = {
      id: 'q_http_1',
      position: 0,
      total: 30,
      zone: 1,
      kind: 'STANDARD',
      themeSlug: 'http',
      statement: 'Quel code de statut HTTP indique que la ressource demandée n’existe pas sur le serveur ?',
      answers: [
        { id: 'ans_200', text: '200 OK' },
        { id: 'ans_500', text: '500 Internal Server Error' },
        { id: 'ans_301', text: '301 Moved Permanently' },
        { id: 'ans_404', text: '404 Not Found' }, // Bonne réponse (à épargner !)
      ],
      eliminatedAnswerIds: [],
      timeLimitMs: 30000,
      startedAt,
      deadlineAt,
    };

    const createSessionPayload: CreateSessionResponse = {
      serverNow: now.toISOString(),
      session: {
        id: 'sess_niveau_1',
        mode: 'NORMAL',
        status: 'IN_PROGRESS',
        score: currentScore,
        hp: currentHp,
        combo: currentCombo,
        multiplier: 1,
        currentIndex: 0,
        total: 30,
        paused: false,
        pauseEndsAt: null,
        pausesLeft: 3,
      },
      question: question1,
    };

    return HttpResponse.json(createSessionPayload, { status: 201 });
  }),

  http.get('*/sessions/:id', () => {
    const detailPayload: SessionDetail = {
      serverNow: new Date().toISOString(),
      session: {
        id: 'sess_niveau_1',
        mode: 'NORMAL',
        status: 'IN_PROGRESS',
        score: currentScore,
        hp: currentHp,
        combo: currentCombo,
        multiplier: 1 + currentCombo * 0.25,
        currentIndex: 0,
        total: 30,
        paused: isPaused,
        pauseEndsAt: isPaused ? new Date(Date.now() + 30000).toISOString() : null,
        pausesLeft: 3,
      },
      question: null,
    };
    return HttpResponse.json(detailPayload, { status: 200 });
  }),

  // Tir sur une cible
  http.post('*/sessions/:id/shots', async ({ request }) => {
    const body = (await request.json()) as { answerId?: string };

    // CAS D'ERREUR ÉCRAN 3 : Conflit 409 (pause en cours ou toggle d'erreur actif)
    if (mockErrorState.gameError || isPaused || body.answerId === 'trigger_error_409') {
      const errorPayload: ApiError = {
        error: {
          code: 'CONFLICT',
          message: 'Tir refusé : action impossible (Simulation 409 CONFLICT MSW)',
        },
      };
      return HttpResponse.json(errorPayload, { status: 409 });
    }

    const answerId = body.answerId || '';

    // Si le joueur tire sur la BONNE réponse (404 Not Found), pénalité !
    if (answerId === 'ans_404') {
      currentHp = Math.max(0, currentHp - 25);
      currentCombo = 0;
      const shotPayload: ShotResponse = {
        serverNow: new Date().toISOString(),
        outcome: 'HIT_CORRECT',
        elapsedMs: 2500,
        session: {
          id: 'sess_niveau_1',
          mode: 'NORMAL',
          status: currentHp <= 0 ? 'LOST' : 'IN_PROGRESS',
          score: currentScore,
          hp: currentHp,
          combo: currentCombo,
          multiplier: 1,
          currentIndex: 0,
          total: 30,
          paused: false,
          pauseEndsAt: null,
          pausesLeft: 3,
        },
        questionClosed: true,
        reveal: {
          correctAnswerId: 'ans_404',
          explanation: 'Attention ! 404 était la bonne réponse à épargner : elle indique une ressource absente.',
          mdnUrl: 'https://developer.mozilla.org/fr/docs/Web/HTTP/Status/404',
          pointsAwarded: 0,
        },
        bonus: null,
        question: null,
        nextQuestion: null,
      };
      return HttpResponse.json(shotPayload, { status: 200 });
    }

    // Le joueur élimine une mauvaise réponse (200, 500 ou 301)
    if (!eliminatedIds.includes(answerId)) {
      eliminatedIds.push(answerId);
    }
    currentScore += 100;
    currentCombo += 1;

    // Toutes les mauvaises réponses abattues ?
    const allWrongsEliminated = ['ans_200', 'ans_500', 'ans_301'].every((id) => eliminatedIds.includes(id));

    if (allWrongsEliminated) {
      // Clôture réussie de la question 1 avec reveal et passage à la question 2
      const shotPayload: ShotResponse = {
        serverNow: new Date().toISOString(),
        outcome: 'ELIMINATED_WRONG',
        elapsedMs: 3200,
        session: {
          id: 'sess_niveau_1',
          mode: 'NORMAL',
          status: 'IN_PROGRESS',
          score: currentScore,
          hp: currentHp,
          combo: currentCombo,
          multiplier: Math.min(4, 1 + currentCombo * 0.25),
          currentIndex: 0,
          total: 30,
          paused: false,
          pauseEndsAt: null,
          pausesLeft: 3,
        },
        questionClosed: true,
        reveal: {
          correctAnswerId: 'ans_404',
          explanation: 'Bravo ! 404 Not Found a bien été épargnée. Vous maîtrisez les statuts d’erreur client.',
          mdnUrl: 'https://developer.mozilla.org/fr/docs/Web/HTTP/Status/404',
          pointsAwarded: 100,
        },
        bonus: null,
        question: null,
        nextQuestion: {
          id: 'q_http_2',
          position: 1,
          total: 30,
          zone: 1,
          kind: 'STANDARD',
          themeSlug: 'http',
          statement: 'Quelle méthode HTTP est définie comme sûre (safe) et idempotente pour consulter une ressource ?',
          answers: [
            { id: 'ans_post', text: 'POST' },
            { id: 'ans_delete', text: 'DELETE' },
            { id: 'ans_patch', text: 'PATCH' },
            { id: 'ans_get', text: 'GET' }, // Bonne réponse
          ],
          eliminatedAnswerIds: [],
          timeLimitMs: 25000,
          startedAt: new Date(Date.now() + 3000).toISOString(),
          deadlineAt: new Date(Date.now() + 28000).toISOString(),
        },
      };
      return HttpResponse.json(shotPayload, { status: 200 });
    }

    // Mauvaise réponse abattue mais il en reste encore à éliminer
    const shotPayload: ShotResponse = {
      serverNow: new Date().toISOString(),
      outcome: 'ELIMINATED_WRONG',
      elapsedMs: 1500,
      session: {
        id: 'sess_niveau_1',
        mode: 'NORMAL',
        status: 'IN_PROGRESS',
        score: currentScore,
        hp: currentHp,
        combo: currentCombo,
        multiplier: Math.min(4, 1 + currentCombo * 0.25),
        currentIndex: 0,
        total: 30,
        paused: false,
        pauseEndsAt: null,
        pausesLeft: 3,
      },
      questionClosed: false,
      reveal: null,
      bonus: null,
      question: null,
      nextQuestion: null,
    };
    return HttpResponse.json(shotPayload, { status: 200 });
  }),

  // Pause / Reprise
  http.post('*/sessions/:id/pause', () => {
    isPaused = true;
    const detailPayload: SessionDetail = {
      serverNow: new Date().toISOString(),
      session: {
        id: 'sess_niveau_1',
        mode: 'NORMAL',
        status: 'IN_PROGRESS',
        score: currentScore,
        hp: currentHp,
        combo: currentCombo,
        multiplier: 1,
        currentIndex: 0,
        total: 30,
        paused: true,
        pauseEndsAt: new Date(Date.now() + 30000).toISOString(),
        pausesLeft: 2,
      },
      question: null,
    };
    return HttpResponse.json(detailPayload, { status: 200 });
  }),

  http.post('*/sessions/:id/resume', () => {
    isPaused = false;
    const detailPayload: SessionDetail = {
      serverNow: new Date().toISOString(),
      session: {
        id: 'sess_niveau_1',
        mode: 'NORMAL',
        status: 'IN_PROGRESS',
        score: currentScore,
        hp: currentHp,
        combo: currentCombo,
        multiplier: 1,
        currentIndex: 0,
        total: 30,
        paused: false,
        pauseEndsAt: null,
        pausesLeft: 2,
      },
      question: null,
    };
    return HttpResponse.json(detailPayload, { status: 200 });
  }),
];
