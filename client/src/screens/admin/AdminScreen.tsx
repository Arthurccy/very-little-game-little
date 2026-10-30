import { useState } from 'react';
import type { Theme } from '../../api/types';
import { QuestionsTab } from './QuestionsTab';
import { StatsTab } from './StatsTab';

export function AdminScreen({ themes, onBack }: { themes: Theme[]; onBack: () => void }) {
  const [tab, setTab] = useState<'questions' | 'stats'>('questions');
  return (
    <main className="panel panel--wide">
      <header className="panel__header">
        <h1 className="title">Back-office</h1>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Retour au menu
        </button>
      </header>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'questions'} onClick={() => setTab('questions')}>
          Questions
        </button>
        <button type="button" role="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')}>
          Statistiques
        </button>
      </div>
      {tab === 'questions' ? <QuestionsTab themes={themes} /> : <StatsTab themes={themes} />}
    </main>
  );
}
