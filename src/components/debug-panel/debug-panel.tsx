import React from 'react';
import { useLogger } from '../../hooks/use-logger';
import type { LoggerConfig } from '../../utils/logger';

interface DebugPanelProps {
  className?: string;
}

/**
 * Panneau de contrôle pour le système de logging
 * Visible uniquement en développement par défaut
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({ className }) => {
  const {
    setLoggingEnabled,
    setLogLevel,
    setTimingEnabled: setLoggerTimingEnabled,
    clearAllTimers,
    getPerformanceStats
  } = useLogger();

  const [isEnabled, setIsEnabled] = React.useState(import.meta.env.DEV);
  const [level, setLevel] = React.useState<LoggerConfig['level']>('info');
  const [timingEnabled, setTimingEnabled] = React.useState(true);
  const [stats, setStats] = React.useState<Record<string, string[]>>({});

  // Synchroniser les états avec le logger
  const handleEnabledChange = (enabled: boolean) => {
    setIsEnabled(enabled);
    setLoggingEnabled(enabled);
  };

  const handleLevelChange = (newLevel: LoggerConfig['level']) => {
    setLevel(newLevel);
    setLogLevel(newLevel);
  };

  const handleTimingChange = (enabled: boolean) => {
    setTimingEnabled(enabled);
    setLoggerTimingEnabled(enabled);
  };

  const handleClearTimers = () => {
    clearAllTimers();
    setStats({});
  };

  const refreshStats = () => {
    setStats(getPerformanceStats());
  };

  // Auto-refresh des stats toutes les 2 secondes si actif
  React.useEffect(() => {
    if (!isEnabled || !timingEnabled) return;

    const interval = setInterval(refreshStats, 2000);
    return () => clearInterval(interval);
  }, [isEnabled, timingEnabled]);

  // Masquer en production si pas explicitement activé
  if (!import.meta.env.DEV && !isEnabled) {
    return null;
  }

  return (
    <div className={`debug-panel ${className || ''}`} style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 10000,
      minWidth: '200px',
      maxWidth: '300px',
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        🔧 Debug Panel
      </div>

      {/* Contrôles principaux */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
          />{' '}
          Logging activé
        </label>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={timingEnabled}
            onChange={(e) => handleTimingChange(e.target.checked)}
            disabled={!isEnabled}
          />{' '}
          Timers activés
        </label>
      </div>

      {/* Niveau de log */}
      {isEnabled && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'block', marginBottom: '4px' }}>
            Niveau:
          </div>
          <select
            value={level}
            onChange={(e) => handleLevelChange(e.target.value as LoggerConfig['level'])}
            style={{
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '11px',
            }}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      )}

      {/* Statistiques des timers */}
      {isEnabled && timingEnabled && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>Timers actifs:</span>
            <div>
              <button
                onClick={refreshStats}
                style={{
                  background: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  marginRight: '4px',
                  cursor: 'pointer',
                }}
              >
                ↻
              </button>
              <button
                onClick={handleClearTimers}
                style={{
                  background: '#cc0000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {Object.entries(stats).map(([category, timers]) => (
            timers.length > 0 && (
              <div key={category} style={{ marginBottom: '4px', fontSize: '10px' }}>
                <div style={{ color: '#aaa' }}>{category}:</div>
                {timers.map((timer) => (
                  <div key={timer} style={{ paddingLeft: '8px', color: '#0f0' }}>
                    • {timer}
                  </div>
                ))}
              </div>
            )
          ))}

          {Object.values(stats).every(timers => timers.length === 0) && (
            <div style={{ color: '#666', fontSize: '10px' }}>
              Aucun timer actif
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div style={{ fontSize: '10px', color: '#888', borderTop: '1px solid #333', paddingTop: '6px' }}>
        Console F12 pour voir les logs détaillés
      </div>
    </div>
  );
};

export default DebugPanel;