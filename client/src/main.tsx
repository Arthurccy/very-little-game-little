import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BOSS_QUESTION_COUNT, STANDARD_QUESTIONS_PER_ZONE, STARTING_HP } from '@fps/shared';
import './styles.css';

/** Écran d'attente de l'étape 1 : pas encore de scène 3D ni d'appel API. */
function WaitingScreen() {
  return (
    <main className="waiting">
      <h1>FPS éducatif</h1>
      <p className="tagline">Élimine les mauvaises réponses. Épargne la bonne.</p>
      <ul className="rules">
        <li>{STARTING_HP} PV au départ</li>
        <li>{STANDARD_QUESTIONS_PER_ZONE} questions par zone, 6 zones</li>
        <li>{BOSS_QUESTION_COUNT} questions pour le boss final</li>
      </ul>
      <p className="status">Socle en place — la scène de jeu arrive à l’étape suivante.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WaitingScreen />
  </StrictMode>,
);
