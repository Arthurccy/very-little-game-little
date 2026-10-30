/**
 * Vérification à la compilation : les types générés du contrat doivent être identiques
 * aux types de `@fps/shared` utilisés par les écrans. Si le contrat ou le code changent
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
];

// Chaque position doit valoir `true` : une divergence casse cette affectation.
export const contractMatchesShared: ContractMatchesShared = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];
