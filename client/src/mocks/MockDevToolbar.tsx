import { useState } from 'react';
import { mockErrorState } from './handlers';

export function MockDevToolbar() {
  const [open, setOpen] = useState(false);
  const [authErr, setAuthErr] = useState(mockErrorState.authError);
  const [themesErr, setThemesErr] = useState(mockErrorState.themesError);
  const [gameErr, setGameErr] = useState(mockErrorState.gameError);

  const toggleAuth = () => {
    mockErrorState.authError = !authErr;
    setAuthErr(!authErr);
  };

  const toggleThemes = () => {
    mockErrorState.themesError = !themesErr;
    setThemesErr(!themesErr);
  };

  const toggleGame = () => {
    mockErrorState.gameError = !gameErr;
    setGameErr(!gameErr);
  };

  return (
    <aside
      aria-label="Contrôle des mocks MSW"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        background: '#181b20',
        border: '1px solid #374151',
        borderRadius: '8px',
        color: '#f3f4f6',
        fontSize: '13px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#1f242d',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '8px',
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: authErr || themesErr || gameErr ? '#f59e0b' : '#10b981',
            }}
          />
          MSW Mock Hub (v1)
        </span>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {open ? '▾ Fermer' : '▴ Démo Erreurs'}
        </button>
      </header>

      {open && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '240px' }}>
          <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '2px' }}>
            Simulateur d’erreurs (Démo 2 min intervenant) :
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={authErr} onChange={toggleAuth} />
            <span>
              <strong>Écran 1 (Auth) :</strong> 401 Unauthenticated
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={themesErr} onChange={toggleThemes} />
            <span>
              <strong>Écran 2 (Menu) :</strong> 500 Erreur serveur
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={gameErr} onChange={toggleGame} />
            <span>
              <strong>Écran 3 (Jeu) :</strong> 409 Conflit de tir
            </span>
          </label>

          <div
            style={{
              marginTop: '4px',
              paddingTop: '8px',
              borderTop: '1px solid #2d3748',
              fontSize: '11px',
              color: '#6b7280',
            }}
          >
            Contrat : <code>contracts/openapi.yaml</code>
          </div>
        </div>
      )}
    </aside>
  );
}
