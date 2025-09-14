/**
 * Performance Logger pour Pixsaur
 * - Inactif en production par défaut
 * - Configurable via options
 * - Timers intégrés pour mesures de performance
 */

export interface LoggerConfig {
  /** Activer le logging (false en production par défaut) */
  enabled: boolean;
  /** Niveau minimum de log */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Préfixe pour tous les logs */
  prefix: string;
  /** Activer les mesures de performance */
  enableTiming: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enabled: import.meta.env.DEV,
  level: 'info',
  prefix: '[Pixsaur]',
  enableTiming: true,
};

class PerformanceLogger {
  private config: LoggerConfig;
  private timers = new Map<string, number>();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Mettre à jour la configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Démarrer un timer
   */
  time(label: string): void {
    if (!this.config.enabled || !this.config.enableTiming) return;
    this.timers.set(label, performance.now());
  }

  /**
   * Arrêter un timer et logger le résultat
   */
  timeEnd(label: string): number | undefined {
    if (!this.config.enabled || !this.config.enableTiming) return;
    
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      this.warn(`Timer "${label}" not found`);
      return;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);
    this.info(`${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Mesurer l'exécution d'une fonction async
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled || !this.config.enableTiming) {
      return fn();
    }

    this.time(label);
    try {
      const result = await fn();
      this.timeEnd(label);
      return result;
    } catch (error) {
      this.timeEnd(label);
      this.error(`${label} failed:`, error);
      throw error;
    }
  }

  /**
   * Mesurer l'exécution d'une fonction synchrone
   */
  timeSync<T>(label: string, fn: () => T): T {
    if (!this.config.enabled || !this.config.enableTiming) {
      return fn();
    }

    this.time(label);
    try {
      const result = fn();
      this.timeEnd(label);
      return result;
    } catch (error) {
      this.timeEnd(label);
      this.error(`${label} failed:`, error);
      throw error;
    }
  }

  /**
   * Log debug
   */
  debug(...args: any[]): void {
    if (!this.config.enabled || !this.shouldLog('debug')) return;
    console.debug(this.config.prefix, ...args);
  }

  /**
   * Log info
   */
  info(...args: any[]): void {
    if (!this.config.enabled || !this.shouldLog('info')) return;
    console.info(this.config.prefix, ...args);
  }

  /**
   * Log warning
   */
  warn(...args: any[]): void {
    if (!this.config.enabled || !this.shouldLog('warn')) return;
    console.warn(this.config.prefix, ...args);
  }

  /**
   * Log error
   */
  error(...args: any[]): void {
    if (!this.config.enabled || !this.shouldLog('error')) return;
    console.error(this.config.prefix, ...args);
  }

  /**
   * Grouper les logs
   */
  group(label: string): void {
    if (!this.config.enabled) return;
    console.group(`${this.config.prefix} ${label}`);
  }

  /**
   * Fermer un groupe de logs
   */
  groupEnd(): void {
    if (!this.config.enabled) return;
    console.groupEnd();
  }

  /**
   * Vérifier si on doit logger selon le niveau
   */
  private shouldLog(level: LoggerConfig['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.config.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Obtenir les statistiques des timers actifs
   */
  getActiveTimers(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Nettoyer tous les timers actifs
   */
  clearTimers(): void {
    this.timers.clear();
  }
}

// Instance globale par défaut
export const logger = new PerformanceLogger();

// Factory pour créer des loggers spécialisés
export const createLogger = (config: Partial<LoggerConfig> = {}) => {
  return new PerformanceLogger(config);
};

// Loggers spécialisés pour différents domaines
export const adapterLogger = createLogger({ prefix: '[Adapter]' });
export const webglLogger = createLogger({ prefix: '[WebGL]' });
export const quantizerLogger = createLogger({ prefix: '[Quantizer]' });
export const paletteLogger = createLogger({ prefix: '[Palette]' });

// Helper pour mesurer les performances critiques
export const measure = {
  /**
   * Mesurer la quantization complète
   */
  quantization: <T>(fn: () => T): T => 
    quantizerLogger.timeSync('Total Quantization', fn),

  /**
   * Mesurer l'adaptation CPU/GPU
   */
  adaptation: <T>(fn: () => T): T => 
    adapterLogger.timeSync('Processor Adaptation', fn),

  /**
   * Mesurer les opérations WebGL
   */
  webgl: <T>(fn: () => T): T => 
    webglLogger.timeSync('WebGL Operation', fn),

  /**
   * Mesurer la génération de palette
   */
  palette: <T>(fn: () => T): T => 
    paletteLogger.timeSync('Palette Generation', fn),
};

export default logger;