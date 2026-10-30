import { useHub } from './HubContext';

/** État du lien avec le hub Full-Stack Quest, affiché dans le menu. */
export function HubBadge() {
  const { status, player, message, retry } = useHub();
  if (status === 'idle') return null;
  if (status === 'linking') return <p className="hub-badge">Connexion au hub Full-Stack Quest…</p>;
  if (status === 'linked' && player) {
    return (
      <p className="hub-badge hub-badge--ok">
        <span>
          Lancé depuis Full-Stack Quest : <b>{player.pseudo}</b> · niveau {player.level}. Ton score lui sera envoyé en
          fin de partie.
        </span>
      </p>
    );
  }
  return (
    <p className="hub-badge hub-badge--error" role="alert">
      <span>{message}</span>
      {status === 'unavailable' && (
        <button type="button" className="btn btn--small" onClick={retry}>
          Réessayer
        </button>
      )}
    </p>
  );
}
