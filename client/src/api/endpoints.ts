// Types générés du contrat de l'équipe (contracts/openapi.yaml).
import type {
  AdminQuestion,
  AdminQuestionInput,
  AuthResponse,
  CreateSessionResponse,
  EndSessionResponse,
  GameMode,
  LeaderboardEntry,
  LeaderboardPage,
  LoginRequest,
  PageMeta,
  QuestionKind,
  QuestionStat,
  RegisterRequest,
  SessionDetail,
  ShotResponse,
  Theme,
  ThemePage,
} from './types';
import type { HubLink, HubLinkRequest, SessionSummaryWithHub } from './hub-relay';
import { api, del, post, put } from './client';

/** Taille de page maximale autorisée par le contrat. */
const MAX_PAGE = 100;

type Page<T> = PageMeta & { items: T[] };

/**
 * Compatibilité temporaire : le serveur actuel renvoie encore des tableaux simples, le
 * contrat v0.2 des pages `{ items, limit, offset, total }`. À supprimer quand le back
 * implémente la pagination.
 */
function asPage<T>(data: Page<T> | T[]): Page<T> {
  return Array.isArray(data) ? { items: data, limit: data.length, offset: 0, total: data.length } : data;
}

function withPage(path: string, limit: number, offset: number, params = new URLSearchParams()): string {
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return `${path}?${params}`;
}

/** Charge toutes les pages d'une liste (le back-office affiche la liste complète). */
async function fetchAll<T>(path: string, params?: URLSearchParams): Promise<T[]> {
  const items: T[] = [];
  for (;;) {
    const page = asPage(await api<Page<T> | T[]>(withPage(path, MAX_PAGE, items.length, params)));
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.total) return items;
  }
}

/**
 * Relais du hub Full-Stack Quest par NOTRE back : le front ne parle jamais au hub
 * directement et n'a jamais la clé X-Game-Key (contracts/integration-v1.yaml).
 * Routes proposées, pas encore dans contracts/openapi.yaml : voir ./hub-relay.ts.
 */
export const hubApi = {
  link: (body: HubLinkRequest) => post<HubLink>('/hub/link', body),
  me: () => api<HubLink>('/hub/me'),
};

export const authApi = {
  register: (body: RegisterRequest) => post<AuthResponse>('/auth/register', body),
  login: (body: LoginRequest) => post<AuthResponse>('/auth/login', body),
  logout: () => post<void>('/auth/logout'),
};

export const gameApi = {
  themes: async (): Promise<Theme[]> => asPage(await api<ThemePage | Theme[]>(withPage('/themes', MAX_PAGE, 0))).items,
  leaderboard: async (limit = 20): Promise<LeaderboardEntry[]> =>
    asPage(await api<LeaderboardPage | LeaderboardEntry[]>(withPage('/leaderboard', limit, 0))).items,
  createSession: (mode: GameMode) => post<CreateSessionResponse>('/sessions', { mode }),
  getSession: (id: string) => api<SessionDetail>(`/sessions/${id}`),
  summary: (id: string) => api<SessionSummaryWithHub>(`/sessions/${id}/summary`),
  shoot: (id: string, answerId: string) => post<ShotResponse>(`/sessions/${id}/shots`, { answerId }),
  timeout: (id: string) => post<ShotResponse>(`/sessions/${id}/timeout`),
  end: (id: string) => post<EndSessionResponse>(`/sessions/${id}/end`),
  pause: (id: string) => post<SessionDetail>(`/sessions/${id}/pause`),
  resume: (id: string) => post<SessionDetail>(`/sessions/${id}/resume`),
};

export const adminApi = {
  list: (filter: { themeId?: string; kind?: QuestionKind; includeInactive?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filter.themeId) params.set('themeId', filter.themeId);
    if (filter.kind) params.set('kind', filter.kind);
    params.set('includeInactive', String(filter.includeInactive ?? true));
    return fetchAll<AdminQuestion>('/admin/questions', params);
  },
  create: (body: AdminQuestionInput) => post<AdminQuestion>('/admin/questions', body),
  update: (id: string, body: AdminQuestionInput) => put<AdminQuestion>(`/admin/questions/${id}`, body),
  deactivate: (id: string) => del(`/admin/questions/${id}`),
  stats: () => fetchAll<QuestionStat>('/stats/questions'),
};
