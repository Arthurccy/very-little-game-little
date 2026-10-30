/**
 * Types de l'API, générés par `npm run generate:api` depuis :
 * - `contracts/front-api.yaml` : notre API (dont le relais vers le hub) → `schema.d.ts` ;
 * - `contracts/integration-v1.yaml` : le contrat du hub Full-Stack Quest → `hub-schema.d.ts`.
 * Ne pas modifier les `.d.ts` à la main : changer le contrat, puis régénérer.
 */
import type { components as HubComponents } from './hub-schema';
import type { components } from './schema';

type Schemas = components['schemas'];
type HubSchemas = HubComponents['schemas'];

/** Joueur et réponse de score tels que définis par le hub (contrat de l'intervenant). */
export type HubPlayer = HubSchemas['Player'];
export type HubScoreResponse = HubSchemas['ScoreResponse'];

export type HubLinkRequest = Schemas['HubLinkRequest'];
export type HubLink = Schemas['HubLink'];
export type HubScore = Schemas['HubScore'];

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
