import { BOSS_QUESTION_COUNT, BOSS_ZONE, STARTING_HP } from '@fps/shared';
import type { BonusType, Theme } from '../../api/types';
import type { GameController } from '../useGame';

const BONUS_LABELS: Record<BonusType, string> = {
  SLOW_TIME: 'Ralenti : +5 s au chrono',
  REMOVE_WRONG: 'Une mauvaise réponse retirée',
  HEAL: 'Soin',
};

interface Props {
  game: GameController;
  theme: Theme | undefined;
  /** Thème de la question suivante, pour annoncer un changement de zone. */
  nextTheme: Theme | undefined;
  locked: boolean;
  muted: boolean;
  musicOn: boolean;
  onToggleMusic: () => void;
  onToggleMute: () => void;
  onAbandon: () => void;
  bossHealth: number;
}

export function Hud({
  game,
  theme,
  nextTheme,
  locked,
  muted,
  onToggleMute,
  musicOn,
  onToggleMusic,
  onAbandon,
  bossHealth,
}: Props) {
  const { session, phase, reveal } = game;
  // Heure de jeu : gelée pendant une pause.
  const now = game.clockNow;
  const shown = reveal?.question ?? game.question;
  const isBoss = shown?.zone === BOSS_ZONE;
  const training = session.mode === 'TRAINING';
  const zoneName = isBoss ? 'Boss final' : (theme?.name ?? '');

  const start = shown ? Date.parse(shown.startedAt) : 0;
  const end = shown ? Date.parse(shown.deadlineAt) : 0;
  const remainingMs = Math.max(0, end - Math.max(now, start));
  const ratio = shown ? remainingMs / (end - start) : 0;
  const nextStart = game.upcoming ? Date.parse(game.upcoming.startedAt) : null;
  const countdown =
    phase === 'countdown' && game.question ? Math.ceil((Date.parse(game.question.startedAt) - now) / 1000) : null;
  const showBonus = game.bonus && performance.now() - game.bonus.at < 2500;

  return (
    <div className="hud" aria-live="polite">
      <div className="hud-top">
        <div className="hud-box">
          <div className="hud-label">PV {training && <span className="badge">Entraînement</span>}</div>
          <div
            className="bar bar--hp"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={STARTING_HP}
            aria-valuenow={session.hp}
          >
            <div style={{ width: `${(session.hp / STARTING_HP) * 100}%` }} />
          </div>
          <div className="hud-value">{session.hp}</div>
        </div>

        <div className="hud-box hud-box--center">
          <div className="hud-label">{zoneName}</div>
          <div className="hud-value">
            Question {Math.min((shown?.position ?? 0) + 1, session.total)} / {session.total}
          </div>
          {isBoss && (
            <div className="bar bar--boss" title="Vie du boss">
              <div style={{ width: `${bossHealth * 100}%` }} />
            </div>
          )}
        </div>

        <div className="hud-box hud-box--right">
          <div className="hud-label">Score</div>
          <div className="hud-value hud-score">{session.score}</div>
          <div className={`combo ${session.combo > 0 ? 'combo--on' : ''}`}>
            Combo {session.combo} · ×{session.multiplier.toFixed(2)}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleMute}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className={`icon-btn ${musicOn ? '' : 'icon-btn--off'}`}
            onClick={onToggleMusic}
            aria-label={musicOn ? 'Couper la musique' : 'Activer la musique'}
            aria-pressed={musicOn}
          >
            🎵
          </button>
        </div>
      </div>

      {phase === 'active' && ratio < 0.25 && <div className="danger-vignette" aria-hidden />}

      {locked && <div className="crosshair" aria-hidden />}

      {showBonus && game.bonus && (
        <div className="toast toast--bonus" key={game.bonus.at}>
          Bonus ! {BONUS_LABELS[game.bonus.drop.type]}
          {game.bonus.drop.type === 'HEAL' && game.bonus.drop.amount ? ` (+${game.bonus.drop.amount} PV)` : ''}
        </div>
      )}

      {game.error && (
        <div className="toast toast--error" role="alert">
          {game.error}
          <button type="button" onClick={game.clearError}>
            OK
          </button>
        </div>
      )}

      {countdown !== null && game.question && (
        <div className="zone-intro">
          {game.question.position === 0 ? (
            <>
              <div className="zone-intro__zone">{isBoss ? 'Zone finale' : `Zone ${game.question.zone}`}</div>
              <h2>{zoneName}</h2>
              <p>
                {isBoss
                  ? `${BOSS_QUESTION_COUNT} questions mélangées, chrono serré, points doublés. Tiens bon !`
                  : theme?.intro}
              </p>
            </>
          ) : null}
          <div className="zone-intro__count">{Math.max(1, countdown)}</div>
        </div>
      )}

      {reveal && (
        <div className={`reveal reveal--${reveal.outcome === 'ELIMINATED_WRONG' ? 'win' : 'fail'}`}>
          <h3>
            {reveal.outcome === 'ELIMINATED_WRONG' && `Bien joué ! +${reveal.reveal.pointsAwarded} pts`}
            {reveal.outcome === 'HIT_CORRECT' && `Tu as abattu la bonne réponse${training ? '' : ' (−25 PV)'}`}
            {reveal.outcome === 'TIMEOUT' && `Temps écoulé${training ? '' : ' (−20 PV)'}`}
          </h3>
          <p className="reveal__answer">
            Bonne réponse :{' '}
            <strong>{reveal.question.answers.find((a) => a.id === reveal.reveal.correctAnswerId)?.text}</strong>
          </p>
          <p>{reveal.reveal.explanation}</p>
          {reveal.reveal.mdnUrl && (
            <a href={reveal.reveal.mdnUrl} target="_blank" rel="noreferrer noopener">
              En savoir plus sur MDN ↗
            </a>
          )}
          {game.upcoming && game.upcoming.zone !== reveal.question.zone && (
            <div className="reveal__zone">
              <strong>Prochaine zone : {game.upcoming.zone === BOSS_ZONE ? 'le boss final' : nextTheme?.name}</strong>
              <span>
                {game.upcoming.zone === BOSS_ZONE
                  ? `${BOSS_QUESTION_COUNT} questions mélangées, chrono serré, points doublés.`
                  : nextTheme?.intro}
              </span>
            </div>
          )}
          {nextStart !== null && (
            <div className="reveal__next">
              Question suivante dans {Math.max(0, Math.ceil((nextStart - now) / 1000))} s
            </div>
          )}
          {session.status !== 'IN_PROGRESS' && (
            <div className="reveal__next">{session.status === 'WON' ? 'Victoire !' : 'Partie terminée…'}</div>
          )}
        </div>
      )}

      {shown && !reveal && (
        <div className="question-panel">
          <div className={`timer ${ratio < 0.25 && phase === 'active' ? 'timer--low' : ''}`}>
            <div style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="question-panel__statement">{shown.statement}</p>
          <p className="question-panel__hint">
            Abats les <strong>mauvaises</strong> réponses, épargne la bonne · {(remainingMs / 1000).toFixed(1)} s
          </p>
        </div>
      )}

      {/* Toujours rendu : PointerLockControls écoute les clics sur #lock-trigger depuis son montage. */}
      <div className="lock-overlay" hidden={locked || session.status !== 'IN_PROGRESS'}>
        <button id="lock-trigger" type="button" className="btn btn--primary btn--big">
          {session.paused ? 'Reprendre' : 'Cliquer pour viser'}
        </button>
        <p>
          Souris : viser · Clic : tirer · ZQSD / WASD : se déplacer · <kbd>1</kbd>–<kbd>6</kbd> : tirer sur une cible ·{' '}
          <kbd>M</kbd> : son · <kbd>N</kbd> : musique · <kbd>Échap</kbd> : pause
        </p>
        <PauseStatus game={game} />
        <button type="button" className="btn btn--ghost" onClick={onAbandon}>
          Abandonner la partie
        </button>
      </div>
    </div>
  );
}

/** État de la pause dans le voile : temps restant, pauses disponibles, ou chrono qui continue. */
function PauseStatus({ game }: { game: GameController }) {
  const { session } = game;
  if (session.paused && session.pauseEndsAt) {
    const left = Math.max(0, Math.ceil((Date.parse(session.pauseEndsAt) - game.now) / 1000));
    return (
      <p className="pause-status pause-status--on" role="status">
        ⏸ Pause — le chrono reprend tout seul dans {left} s · {session.pausesLeft} pause
        {session.pausesLeft > 1 ? 's' : ''} restante{session.pausesLeft > 1 ? 's' : ''}
      </p>
    );
  }
  if (session.pausesLeft === 0) {
    return <p className="pause-status pause-status--off">Plus de pause disponible : le chrono continue.</p>;
  }
  return (
    <p className="muted">
      <kbd>Échap</kbd> ou <kbd>P</kbd> met en pause ({session.pausesLeft} restante{session.pausesLeft > 1 ? 's' : ''},{' '}
      30 s max chacune).
    </p>
  );
}
