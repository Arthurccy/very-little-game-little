/**
 * Types de l'API, générés depuis le contrat OpenAPI (`contract/openapi.yaml`) par
 * `npm run generate:api`. Ne pas modifier `schema.d.ts` à la main : changer le contrat,
 * puis régénérer.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type ApiError = Schemas['ApiError'];
export type AuthResponse = Schemas['AuthResponse'];
export type LoginRequest = Schemas['LoginRequest'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type PublicUser = Schemas['PublicUser'];
export type Theme = Schemas['Theme'];
export type GameMode = Schemas['GameMode'];
export type QuestionKind = Schemas['QuestionKind'];
export type PublicQuestion = Schemas['PublicQuestion'];
export type SessionState = Schemas['SessionState'];
export type CreateSessionRequest = Schemas['CreateSessionRequest'];
export type CreateSessionResponse = Schemas['CreateSessionResponse'];
export type SessionDetailResponse = Schemas['SessionDetailResponse'];
export type ShotRequest = Schemas['ShotRequest'];
export type ShotResponse = Schemas['ShotResponse'];
export type EndSessionResponse = Schemas['EndSessionResponse'];
export type SessionSummary = Schemas['SessionSummary'];
export type LeaderboardEntry = Schemas['LeaderboardEntry'];
export type QuestionStat = Schemas['QuestionStat'];
export type AdminQuestion = Schemas['AdminQuestion'];
export type AdminQuestionInput = Schemas['AdminQuestionInput'];
