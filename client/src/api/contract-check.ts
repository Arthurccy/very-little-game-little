/**
 * Vérification à la compilation : les types générés du contrat doivent être identiques
 * aux types de `@fps/shared` utilisés par les écrans, et le relais du hub aux schémas du hub. Si le contrat ou le code changent
 * sans l'autre, `npm run typecheck` échoue ici en nommant le type qui diverge.
 */
import type * as Dto from '@fps/shared';
import type * as Api from './types';

/** `true` seulement si A et B sont assignables l'un à l'autre. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type ContractMatchesShared = [
  Same<Api.ApiError, Dto.ApiError>,
  Same<Api.AuthResponse, Dto.AuthResponse>,
  Same<Api.LoginRequest, Dto.LoginRequest>,
  Same<Api.RegisterRequest, Dto.RegisterRequest>,
  Same<Api.Theme, Dto.ThemeDTO>,
  Same<Api.PublicQuestion, Dto.PublicQuestion>,
  Same<Api.SessionState, Dto.SessionStateDTO>,
  Same<Api.CreateSessionResponse, Dto.CreateSessionResponse>,
  Same<Api.SessionDetailResponse, Dto.SessionDetailResponse>,
  Same<Api.ShotResponse, Dto.ShotResponse>,
  Same<Api.EndSessionResponse, Dto.EndSessionResponse>,
  Same<Api.SessionSummary, Dto.SessionSummaryDTO>,
  Same<Api.LeaderboardEntry, Dto.LeaderboardEntry>,
  Same<Api.QuestionStat, Dto.QuestionStatDTO>,
  Same<Api.AdminQuestion, Dto.AdminQuestionDTO>,
  Same<Api.AdminQuestionInput, Dto.AdminQuestionInput>,
  // Le relais du back expose exactement les schémas du hub (contracts/integration-v1.yaml).
  Same<Api.HubLink['player'], Api.HubPlayer>,
  Same<NonNullable<Api.HubScore['result']>, Api.HubScoreResponse>,
];

/** N'accepte qu'un tuple de `true` : une seule divergence fait échouer la compilation ici. */
type AllTrue<T extends readonly true[]> = T;
export type ContractCheck = AllTrue<ContractMatchesShared>;
