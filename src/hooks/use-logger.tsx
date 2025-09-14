import { useCallback, useEffect } from 'react';
import { logger, adapterLogger, webglLogger, quantizerLogger, paletteLogger, type LoggerConfig } from '../utils/logger';

/**
 * Hook pour gérer la configuration du logger
 */
export const useLogger = () => {
  /**
   * Activer/désactiver le logging
   */
  const setLoggingEnabled = useCallback((enabled: boolean) => {
    const config: Partial<LoggerConfig> = { enabled };
    logger.configure(config);
    adapterLogger.configure(config);
    webglLogger.configure(config);
    quantizerLogger.configure(config);
    paletteLogger.configure(config);
  }, []);

  /**
   * Changer le niveau de log
   */
  const setLogLevel = useCallback((level: LoggerConfig['level']) => {
    const config: Partial<LoggerConfig> = { level };
    logger.configure(config);
    adapterLogger.configure(config);
    webglLogger.configure(config);
    quantizerLogger.configure(config);
    paletteLogger.configure(config);
  }, []);

  /**
   * Activer/désactiver les timers
   */
  const setTimingEnabled = useCallback((enableTiming: boolean) => {
    const config: Partial<LoggerConfig> = { enableTiming };
    logger.configure(config);
    adapterLogger.configure(config);
    webglLogger.configure(config);
    quantizerLogger.configure(config);
    paletteLogger.configure(config);
  }, []);

  /**
   * Configuration complète
   */
  const configureLogging = useCallback((config: Partial<LoggerConfig>) => {
    logger.configure(config);
    adapterLogger.configure(config);
    webglLogger.configure(config);
    quantizerLogger.configure(config);
    paletteLogger.configure(config);
  }, []);

  /**
   * Nettoyer tous les timers actifs
   */
  const clearAllTimers = useCallback(() => {
    logger.clearTimers();
    adapterLogger.clearTimers();
    webglLogger.clearTimers();
    quantizerLogger.clearTimers();
    paletteLogger.clearTimers();
  }, []);

  /**
   * Obtenir les statistiques de performance
   */
  const getPerformanceStats = useCallback(() => {
    return {
      logger: logger.getActiveTimers(),
      adapter: adapterLogger.getActiveTimers(),
      webgl: webglLogger.getActiveTimers(),
      quantizer: quantizerLogger.getActiveTimers(),
      palette: paletteLogger.getActiveTimers(),
    };
  }, []);

  // Nettoyer les timers au démontage
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    setLoggingEnabled,
    setLogLevel,
    setTimingEnabled,
    configureLogging,
    clearAllTimers,
    getPerformanceStats,
  };
};

export default useLogger;