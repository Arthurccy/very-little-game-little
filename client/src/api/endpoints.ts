import type {
  AdminQuestionDTO,
  AdminQuestionInput,
  AuthResponse,
  CreateSessionResponse,
  EndSessionResponse,
  GameMode,
  LeaderboardEntry,
  LoginRequest,
  QuestionKind,
  QuestionStatDTO,
  RegisterRequest,
  SessionDetailResponse,
  SessionSummaryDTO,
  ShotResponse,
  ThemeDTO,
  TimeoutResponse,
} from '@fps/shared';
import { api, del, post, put } from './client';

export const authApi = {
  register: (body: RegisterRequest) => post<AuthResponse>('/auth/register', body),
  login: (body: LoginRequest) => post<AuthResponse>('/auth/login', body),
  logout: () => post<void>('/auth/logout'),
};

export const gameApi = {
  themes: () => api<ThemeDTO[]>('/themes'),
  leaderboard: (limit = 20) => api<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`),
  createSession: (mode: GameMode) => post<CreateSessionResponse>('/sessions', { mode }),
  getSession: (id: string) => api<SessionDetailResponse>(`/sessions/${id}`),
  summary: (id: string) => api<SessionSummaryDTO>(`/sessions/${id}/summary`),
  shoot: (id: string, answerId: string) => post<ShotResponse>(`/sessions/${id}/shots`, { answerId }),
  timeout: (id: string) => post<TimeoutResponse>(`/sessions/${id}/timeout`),
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
    return api<AdminQuestionDTO[]>(`/admin/questions?${params}`);
  },
  create: (body: AdminQuestionInput) => post<AdminQuestionDTO>('/admin/questions', body),
  update: (id: string, body: AdminQuestionInput) => put<AdminQuestionDTO>(`/admin/questions/${id}`, body),
  deactivate: (id: string) => del(`/admin/questions/${id}`),
  stats: () => api<QuestionStatDTO[]>('/stats/questions'),
};
