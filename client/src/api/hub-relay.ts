/**
 * Relais du hub Full-Stack Quest par NOTRE back — PROPOSITION, pas encore dans
 * `contracts/openapi.yaml`. Ces formes sont à valider avec l'équipe back puis à ajouter
 * au contrat ; le front les régénérera alors au lieu de les déclarer ici.
 *
 * - `POST /hub/link` `{ fsqToken }` → `HubLink` : le back vérifie le jeton via `GET /api/v1/me`.
 *   422 si le hub refuse le jeton, 502 si le hub est injoignable.
 * - `GET /hub/me` → `HubLink`, 404 si aucun joueur du hub n'est associé.
 * - `GET /sessions/{id}/summary` gagnerait `hub?: HubScore` (envoi du score par `POST /api/v1/scores`).
 *
 * Seuls `Player` et `ScoreResponse` viennent d'un contrat : `contracts/integration-v1.yaml`.
 */
import type { HubPlayer, HubScoreResponse, SessionSummary } from './types';

export interface HubLinkRequest {
  fsqToken: string;
}

export interface HubLink {
  player: HubPlayer;
}

export interface HubScore {
  /**
   * SENT : score accepté par le hub. NOT_LINKED : partie lancée hors du hub.
   * NOT_RANKED : entraînement ou abandon. FAILED : le hub a refusé ou n'a pas répondu.
   */
  status: 'SENT' | 'NOT_LINKED' | 'NOT_RANKED' | 'FAILED';
  result: HubScoreResponse | null;
}

/** Bilan de fin de partie, avec le champ `hub` proposé. */
export type SessionSummaryWithHub = SessionSummary & { hub?: HubScore };
