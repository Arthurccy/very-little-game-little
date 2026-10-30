// Types générés du contrat OpenAPI (contracts/front-api.yaml).
import type {
  AdminQuestion,
  AdminQuestionInput,
  AuthResponse,
  CreateSessionResponse,
  EndSessionResponse,
  GameMode,
  HubLink,
  HubLinkRequest,
  LeaderboardEntry,
  LoginRequest,
  QuestionKind,
  QuestionStat,
  RegisterRequest,
  SessionDetailResponse,
  SessionSummary,
  ShotResponse,
  Theme,
} from './types';
import { api, del, post, put } from './client';

/**
 * Relais du hub Full-Stack Quest par NOTRE back : le front ne parle jamais au hub
 * directement et n'a jamais la clé X-Game-Key (contracts/integration-v1.yaml).
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
  themes: () => api<Theme[]>('/themes'),
  leaderboard: (limit = 20) => api<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`),
  createSession: (mode: GameMode) => post<CreateSessionResponse>('/sessions', { mode }),
  getSession: (id: string) => api<SessionDetailResponse>(`/sessions/${id}`),
  summary: (id: string) => api<SessionSummary>(`/sessions/${id}/summary`),
  shoot: (id: string, answerId: string) => post<ShotResponse>(`/sessions/${id}/shots`, { answerId }),
  timeout: (id: string) => post<ShotResponse>(`/sessions/${id}/timeout`),
  end: (id: string) => post<EndSessionResponse>(`/sessions/${id}/end`),
  pause: (id: string) => post<SessionDetailResponse>(`/sessions/${id}/pause`),
  resume: (id: string) => post<SessionDetailResponse>(`/sessions/${id}/resume`),
};

export const adminApi = {
  list: (filter: { themeId?: string; kind?: QuestionKind; includeInactive?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filter.themeId) params.set('themeId', filter.themeId);
    if (filter.kind) params.set('kind', filter.kind);
    params.set('includeInactive', String(filter.includeInactive ?? true));
    return api<AdminQuestion[]>(`/admin/questions?${params}`);
  },
  create: (body: AdminQuestionInput) => post<AdminQuestion>('/admin/questions', body),
  update: (id: string, body: AdminQuestionInput) => put<AdminQuestion>(`/admin/questions/${id}`, body),
  deactivate: (id: string) => del(`/admin/questions/${id}`),
  stats: () => api<QuestionStat[]>('/stats/questions'),
};
