import { useCallback, useEffect } from "react";
import {
  adapterLogger,
  type LoggerConfig,
  logger,
  paletteLogger,
  quantizerLogger,
  UnifiedLogger,
  webglLogger,
} from "../utils/logger/unified-logger";

/**
 * Hook DRY pour gérer la configuration du logger unifié
 *
 * REFACTORISATION: Utilise maintenant le système unifié pour éliminer
 * la duplication de code dans les appels de configuration.
 */
export const useLogger = () => {
  /**
   * AMÉLIORATION DRY: Configuration centralisée au lieu de 6 appels
   */
  const setLoggingEnabled = useCallback((enabled: boolean) => {
    UnifiedLogger.configureAll({ enabled });
  }, []);

  /**
   * AMÉLIORATION DRY: Un seul appel au lieu de 6
   */
  const setLogLevel = useCallback((level: LoggerConfig["level"]) => {
    UnifiedLogger.configureAll({ level });
  }, []);

  /**
   * AMÉLIORATION DRY: Configuration des timers unifiée
   */
  const setTimingEnabled = useCallback((enableTimers: boolean) => {
    UnifiedLogger.configureAll({ enableTimers });
  }, []);
  /**
   * AMÉLIORATION DRY: Configuration groupée unifiée
   */
  const setGroupingEnabled = useCallback((enableGroups: boolean) => {
    UnifiedLogger.configureAll({ enableGroups });
  }, []);

  /**
   * AMÉLIORATION DRY: Configuration complète centralisée
   */
  const configureLogging = useCallback((config: Partial<LoggerConfig>) => {
    UnifiedLogger.configureAll(config);
  }, []);

  /**
   * AMÉLIORATION DRY: Nettoyage centralisé des timers
   */
  const clearAllTimers = useCallback(() => {
    // Nettoyer les timers de toutes les instances
    const allInstances = UnifiedLogger.getAllInstances();
    for (const instance of allInstances.values()) {
      instance.clearActiveTimers();
    }
  }, []);

  /**
   * AMÉLIORATION DRY: Statistiques unifiées
   */
  const getPerformanceStats = useCallback(() => {
    const allInstances = UnifiedLogger.getAllInstances();
    const stats: Record<string, string[]> = {};

    for (const [name, instance] of allInstances) {
      stats[name] = instance.getActiveTimers();
    }

    return stats;
  }, []);

  // Nettoyer les timers au démontage
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    // Configuration centralisée (DRY)
    setLoggingEnabled,
    setLogLevel,
    setTimingEnabled,
    setGroupingEnabled,
    configureLogging,

    // Monitoring centralisé (DRY)
    clearAllTimers,
    getPerformanceStats,

    // Accès direct aux loggers (compatibilité)
    logger,
    adapterLogger,
    quantizerLogger,
    paletteLogger,
    webglLogger,
  };
};
