/**
 * Handlers Mock Service Worker de tous les appels de l'application, typés par le contrat
 * OpenAPI (`../api/types`, généré depuis `contracts/front-api.yaml`). Le corps de chaque
 * réponse doit respecter le contrat, sinon la compilation échoue.
 */
import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver } from 'msw';
import { API_URL } from '../api/client';
import type {
  AdminQuestion,
  AdminQuestionInput,
  ApiError,
  AuthResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  EndSessionResponse,
  HubLink,
  HubLinkRequest,
  LeaderboardEntry,
  LoginRequest,
  QuestionStat,
  RegisterRequest,
  SessionDetailResponse,
  SessionSummary,
  ShotRequest,
  ShotResponse,
  Theme,
} from '../api/types';
import { admin, auth, game, hub, leaderboard, listThemes, MockApiError } from './db';
import { activeScenario, type ScenarioId } from './scenarios';

const url = (path: string) => `${API_URL}${path}`;

/** Latence réaliste, pour voir les états de chargement. */
const LATENCY_MS = 120;

function errorResponse(status: number, code: ApiError['error']['code'], message: string, details?: unknown) {
  const body: ApiError = { error: details === undefined ? { code, message } : { code, message, details } };
  return HttpResponse.json(body, { status });
}

/** Réponse JSON typée par le contrat : le corps doit être du type annoncé. */
const json = <T extends DefaultBodyType>(body: T, status = 200) => HttpResponse.json<T>(body, { status });

type Resolver = (info: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) => Response | Promise<Response>;

/**
 * Enveloppe commune : latence, scénario « réseau coupé », scénario d'erreur propre à la
 * route, et conversion des MockApiError du faux serveur en réponses ApiError du contrat.
 */
function route(scenario: ScenarioId | null, forced: () => Response, resolver: Resolver): HttpResponseResolver {
  return async ({ request, params }) => {
    await delay(LATENCY_MS);
    const active = activeScenario();
    if (active === 'offline') return HttpResponse.error();
    if (scenario && active === scenario) return forced();
    try {
      return await resolver({ request, params });
    } catch (err) {
      if (err instanceof MockApiError) return errorResponse(err.status, err.code, err.message, err.details);
      throw err;
    }
  };
}

const id = (params: Record<string, string | readonly string[] | undefined>) => String(params.id);
const userId = (request: Request) => auth.fromHeader(request.headers.get('authorization')).id;
const body = <T>(request: Request) => request.json() as Promise<T>;

const noScenario = () => new Response(null, { status: 500 });

const refused400 = () =>
  errorResponse(400, 'VALIDATION', 'Requête invalide', [
    { path: 'statement', message: 'Énoncé refusé par le serveur (scénario de démonstration)' },
  ]);

export const handlers = [
  // --- Écran de connexion -------------------------------------------------
  http.post(
    url('/auth/login'),
    route(
      'login-401',
      () => errorResponse(401, 'UNAUTHENTICATED', 'Email ou mot de passe incorrect'),
      async ({ request }) => json<AuthResponse>(auth.login(await body<LoginRequest>(request))),
    ),
  ),
  http.post(
    url('/auth/register'),
    route(null, noScenario, async ({ request }) =>
      json<AuthResponse>(auth.register(await body<RegisterRequest>(request)), 201),
    ),
  ),
  http.post(
    url('/auth/refresh'),
    route(null, noScenario, () => json<AuthResponse>(auth.refresh())),
  ),
  http.post(
    url('/auth/logout'),
    route(null, noScenario, () => {
      auth.logout();
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  // --- Hub Full-Stack Quest (relais par notre back) ------------------------
  http.post(
    url('/hub/link'),
    route(
      'hub-link-invalid',
      () => errorResponse(400, 'VALIDATION', 'Le jeton du hub est invalide ou a expiré'),
      async ({ request }) => {
        const { fsqToken } = await body<HubLinkRequest>(request);
        return json<HubLink>(hub.link(userId(request), fsqToken));
      },
    ),
  ),
  http.get(
    url('/hub/me'),
    route(null, noScenario, ({ request }) => json<HubLink>(hub.me(userId(request)))),
  ),

  // --- Menu ---------------------------------------------------------------
  http.get(
    url('/themes'),
    route(null, noScenario, () => json<Theme[]>(listThemes())),
  ),
  http.post(
    url('/sessions'),
    route(
      'menu-start-409',
      () => errorResponse(409, 'CONFLICT', 'Pas assez de questions actives pour le thème « Cache HTTP »'),
      async ({ request }) => {
        const { mode } = await body<CreateSessionRequest>(request);
        return json<CreateSessionResponse>(game.create(userId(request), mode), 201);
      },
    ),
  ),

  // --- Partie -------------------------------------------------------------
  http.get(
    url('/sessions/:id'),
    route(null, noScenario, ({ request, params }) =>
      json<SessionDetailResponse>(game.get(userId(request), id(params))),
    ),
  ),
  http.post(
    url('/sessions/:id/shots'),
    route(
      'game-shot-500',
      () => errorResponse(500, 'INTERNAL', 'Erreur interne'),
      async ({ request, params }) => {
        const { answerId } = await body<ShotRequest>(request);
        return json<ShotResponse>(game.shoot(userId(request), id(params), answerId));
      },
    ),
  ),
  http.post(
    url('/sessions/:id/timeout'),
    route(null, noScenario, ({ request, params }) => json<ShotResponse>(game.timeout(userId(request), id(params)))),
  ),
  http.post(
    url('/sessions/:id/pause'),
    route(null, noScenario, ({ request, params }) =>
      json<SessionDetailResponse>(game.pause(userId(request), id(params))),
    ),
  ),
  http.post(
    url('/sessions/:id/resume'),
    route(null, noScenario, ({ request, params }) =>
      json<SessionDetailResponse>(game.resume(userId(request), id(params))),
    ),
  ),
  http.post(
    url('/sessions/:id/end'),
    route(null, noScenario, ({ request, params }) => json<EndSessionResponse>(game.end(userId(request), id(params)))),
  ),

  // --- Fin de partie ------------------------------------------------------
  http.get(
    url('/sessions/:id/summary'),
    route(
      'end-summary-404',
      () => errorResponse(404, 'NOT_FOUND', 'Partie introuvable'),
      ({ request, params }) => json<SessionSummary>(game.summary(userId(request), id(params))),
    ),
  ),

  // --- Classement ---------------------------------------------------------
  http.get(
    url('/leaderboard'),
    route(
      'leaderboard-500',
      () => errorResponse(500, 'INTERNAL', 'Erreur interne'),
      ({ request }) => {
        const limit = Number(new URL(request.url).searchParams.get('limit') ?? 20) || 20;
        return json<LeaderboardEntry[]>(leaderboard(Math.min(100, Math.max(1, limit))));
      },
    ),
  ),

  // --- Back-office --------------------------------------------------------
  http.get(
    url('/admin/questions'),
    route(null, noScenario, ({ request }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      const query = new URL(request.url).searchParams;
      return json<AdminQuestion[]>(
        admin.list({
          themeId: query.get('themeId'),
          kind: query.get('kind'),
          includeInactive: query.get('includeInactive') !== 'false',
        }),
      );
    }),
  ),
  http.get(
    url('/admin/questions/:id'),
    route(null, noScenario, ({ request, params }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      return json<AdminQuestion>(admin.get(id(params)));
    }),
  ),
  http.post(
    url('/admin/questions'),
    route('admin-save-400', refused400, async ({ request }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      return json<AdminQuestion>(admin.create(await body<AdminQuestionInput>(request)), 201);
    }),
  ),
  http.put(
    url('/admin/questions/:id'),
    route('admin-save-400', refused400, async ({ request, params }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      return json<AdminQuestion>(admin.update(id(params), await body<AdminQuestionInput>(request)));
    }),
  ),
  http.delete(
    url('/admin/questions/:id'),
    route(null, noScenario, ({ request, params }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      admin.deactivate(id(params));
      return new HttpResponse(null, { status: 204 });
    }),
  ),
  http.get(
    url('/stats/questions'),
    route(null, noScenario, ({ request }) => {
      auth.requireAdmin(request.headers.get('authorization'));
      return json<QuestionStat[]>(admin.stats());
    }),
  ),
];
