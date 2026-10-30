/**
 * Types de l'API, générés par `npm run generate:api` depuis :
 * - `contracts/openapi.yaml` : le contrat de l'équipe (notre API) → `schema.d.ts` ;
 * - `contracts/integration-v1.yaml` : le contrat du hub Full-Stack Quest → `hub-schema.d.ts`.
 * Ne pas modifier les `.d.ts` à la main : changer le contrat, puis régénérer.
 */
import type { components as HubComponents } from './hub-schema';
import type { components } from './schema';

type Schemas = components['schemas'];
type HubSchemas = HubComponents['schemas'];

export type ApiError = Schemas['ApiError'];
export type ApiErrorCode = ApiError['error']['code'];
export type PublicUser = Schemas['PublicUser'];
export type AuthResponse = Schemas['AuthResponse'];
export type LoginRequest = Schemas['LoginRequest'];
export type RegisterRequest = Schemas['RegisterRequest'];

export type GameMode = Schemas['GameMode'];
export type QuestionKind = Schemas['QuestionKind'];
export type BonusType = Schemas['BonusType'];
export type ShotOutcome = Schemas['ShotOutcome'];

export type Theme = Schemas['Theme'];
export type PublicAnswer = Schemas['PublicAnswer'];
export type PublicQuestion = Schemas['PublicQuestion'];
export type SessionState = Schemas['SessionState'];
export type CreateSessionRequest = Schemas['CreateSessionRequest'];
export type CreateSessionResponse = Schemas['CreateSessionResponse'];
export type SessionDetail = Schemas['SessionDetail'];
export type QuestionReveal = Schemas['QuestionReveal'];
export type BonusDrop = Schemas['BonusDrop'];
export type ShotRequest = Schemas['ShotRequest'];
export type ShotResponse = Schemas['ShotResponse'];
export type EndSessionResponse = Schemas['EndSessionResponse'];
export type SessionSummary = Schemas['SessionSummary'];

export type PageMeta = Schemas['PageMeta'];
export type LeaderboardEntry = Schemas['LeaderboardEntry'];
export type QuestionStat = Schemas['QuestionStat'];
export type ThemePage = Schemas['ThemePage'];
export type LeaderboardPage = Schemas['LeaderboardPage'];
export type QuestionStatPage = Schemas['QuestionStatPage'];

export type AdminAnswerInput = Schemas['AdminAnswerInput'];
export type AdminQuestionInput = Schemas['AdminQuestionInput'];
export type AdminQuestion = Schemas['AdminQuestion'];
export type AdminQuestionPage = Schemas['AdminQuestionPage'];

/** Joueur et réponse de score tels que définis par le hub (contrat de l'intervenant). */
export type HubPlayer = HubSchemas['Player'];
export type HubScoreResponse = HubSchemas['ScoreResponse'];
