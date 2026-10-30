import { useState } from 'react';
import { DEMO_ACCOUNTS } from './db';
import { activeScenario, SCENARIOS, setActiveScenario, type ScenarioId } from './scenarios';

/**
 * Panneau du mode maquette : choisir un scénario d'erreur (un par écran) et rappeler les
 * comptes de démonstration. N'existe que dans `npm run dev:mock`.
 */
export function MockPanel() {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId | null>(activeScenario);

  const choose = (id: ScenarioId | null) => {
    setActiveScenario(id);
    setScenario(id);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="mock-pill"
        onClick={() => {
          // Relit le scénario : il a pu changer dans un autre onglet.
          setScenario(activeScenario());
          setOpen(true);
        }}
        aria-label="Ouvrir le panneau des maquettes"
      >
        Maquettes MSW{scenario ? ' · erreur active' : ''}
      </button>
    );
  }

  return (
    <aside className="mock-panel" aria-label="Maquettes MSW">
      <header>
        <strong>Maquettes MSW</strong>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </header>
      <p className="muted">Aucun backend : l’API est simulée dans le navigateur.</p>
      <fieldset>
        <legend>Scénario d’erreur</legend>
        <label>
          <input type="radio" name="mock-scenario" checked={scenario === null} onChange={() => choose(null)} />
          Aucune erreur
        </label>
        {SCENARIOS.map((s) => (
          <label key={s.id}>
            <input type="radio" name="mock-scenario" checked={scenario === s.id} onChange={() => choose(s.id)} />
            <span>
              <b>{s.screen}</b> — {s.label}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="muted">
        Comptes (mot de passe « {DEMO_ACCOUNTS[0].password} ») : {DEMO_ACCOUNTS.map((a) => a.email).join(' · ')}
      </p>
    </aside>
  );
}
