/**
 * Logger Unifié DRY - Single Source of Truth pour le Logging
 *
 * Ce module remplace les 6 loggers actuels par un système unifié qui élimine
 * la duplication de code et centralise la configuration.
 *
 * AVANT (Problématique):
 * - adapterLogger, quantizerLogger, paletteLogger, webglLogger, logger, createLogger
 * - Code dupliqué pour chaque logger
 * - Configuration inconsistante
 * - Maintenance difficile
 *
 * APRÈS (Solution DRY):
 * - UnifiedLogger avec instances par module
 * - Configuration centralisée
 * - Interface cohérente
 * - Maintenance simplifiée
 */

export interface LoggerConfig {
  readonly enabled: boolean
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly enableTimers: boolean
  readonly enableGroups: boolean
  readonly prefix?: string
  readonly color?: string
}

export interface TimerHandle {
  readonly name: string
  readonly startTime: number
  end(): void
}

export interface LoggerInterface {
  // Core logging methods
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void

  // Grouping
  group(label: string): void
  groupEnd(): void

  // Performance timing
  time(name: string): TimerHandle
  timeSync<T>(name: string, fn: () => T): T
  timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T>

  // Configuration
  configure(config: Partial<LoggerConfig>): void
  isEnabled(): boolean
  getConfig(): LoggerConfig
}

/**
 * Emojis standards pour chaque module (DRY pattern)
 */
export const MODULE_EMOJIS = {
  core: 'core',
  adapter: 'adapter',
  quantizer: 'quantizer',
  palette: 'palette',
  webgl: 'webgl',
  regl: 'webgl',
  factory: 'factory',
  export: 'export',
  import: 'import',
  performance: 'performance'
} as const

export type ModuleName = keyof typeof MODULE_EMOJIS

/**
 * Configuration par défaut commune à tous les loggers
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  enabled: true,
  level: 'info',
  enableTimers: true,
  enableGroups: true,
  prefix: '',
  color: '#888'
}

/**
 * Logger unifié implémentant le principe DRY
 * Centralise toute la logique de logging commune
 */
export class UnifiedLogger implements LoggerInterface {
  private config: LoggerConfig
  private activeTimers = new Map<string, number>()
  private static instances = new Map<string, UnifiedLogger>()

  private constructor(
    private readonly moduleName: string,
    initialConfig: Partial<LoggerConfig> = {}
  ) {
    const emoji = MODULE_EMOJIS[moduleName as ModuleName] || 'default'
    this.config = {
      ...DEFAULT_LOGGER_CONFIG,
      prefix: `${emoji} [${moduleName.toUpperCase()}]`,
      ...initialConfig
    }
  }

  /**
   * factory Factory Method - Single Point of Creation (DRY)
   * Garantit une seule instance par module
   */
  static getInstance(
    moduleName: string,
    config: Partial<LoggerConfig> = {}
  ): UnifiedLogger {
    if (!UnifiedLogger.instances.has(moduleName)) {
      UnifiedLogger.instances.set(
        moduleName,
        new UnifiedLogger(moduleName, config)
      )
    }

    const instance = UnifiedLogger.instances.get(moduleName)!

    // Mettre à jour la config si fournie
    if (Object.keys(config).length > 0) {
      instance.configure(config)
    }

    return instance
  }

  /**
   * core Configuration centralisée (DRY)
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): LoggerConfig {
    return { ...this.config }
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Vérification du niveau de log (DRY Logic)
   */
  private shouldLog(level: LoggerConfig['level']): boolean {
    if (!this.config.enabled) return false

    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const requestedLevelIndex = levels.indexOf(level)

    return requestedLevelIndex >= currentLevelIndex
  }

  /**
   * palette Formatage des messages (DRY Logic)
   */
  private formatMessage(...args: any[]): any[] {
    if (!this.config.prefix) return args

    const styledPrefix = this.config.color
      ? [
          `%c${this.config.prefix}`,
          `color: ${this.config.color}; font-weight: bold`
        ]
      : [this.config.prefix]

    return [...styledPrefix, ...args]
  }

  // ===============================
  // Core Logging Methods (DRY)
  // ===============================

  debug(...args: any[]): void {
    if (!this.shouldLog('debug')) return
    console.debug(...this.formatMessage(...args))
  }

  info(...args: any[]): void {
    if (!this.shouldLog('info')) return
    console.info(...this.formatMessage(...args))
  }

  warn(...args: any[]): void {
    if (!this.shouldLog('warn')) return
    console.warn(...this.formatMessage(...args))
  }

  error(...args: any[]): void {
    if (!this.shouldLog('error')) return
    console.error(...this.formatMessage(...args))
  }

  // ===============================
  // Grouping Methods (DRY)
  // ===============================

  group(label: string): void {
    if (!this.config.enabled || !this.config.enableGroups) return
    console.group(...this.formatMessage(label))
  }

  groupEnd(): void {
    if (!this.config.enabled || !this.config.enableGroups) return
    console.groupEnd()
  }

  // ===============================
  // ⏱️ Performance Timing (DRY)
  // ===============================

  time(name: string): TimerHandle {
    if (!this.config.enableTimers) {
      return {
        name,
        startTime: 0,
        end: () => {}
      }
    }

    const startTime = globalThis.performance.now()
    const timerKey = `${this.moduleName}-${name}`
    this.activeTimers.set(timerKey, startTime)

    this.debug(`⏱️ Timer started: ${name}`)

    return {
      name,
      startTime,
      end: () => {
        const endTime = globalThis.performance.now()
        const duration = endTime - startTime
        this.activeTimers.delete(timerKey)
        this.info(`completed ${name} completed in ${duration.toFixed(2)}ms`)
      }
    }
  }

  timeSync<T>(name: string, fn: () => T): T {
    const timer = this.time(name)
    try {
      const result = fn()
      timer.end()
      return result
    } catch (error) {
      timer.end()
      this.error(`failed ${name} failed:`, error)
      throw error
    }
  }

  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const timer = this.time(name)
    try {
      const result = await fn()
      timer.end()
      return result
    } catch (error) {
      timer.end()
      this.error(`failed ${name} failed:`, error)
      throw error
    }
  }

  // ===============================
  // Utility Methods
  // ===============================

  /**
   * Obtenir les timers actifs pour ce module
   */
  getActiveTimers(): string[] {
    const modulePrefix = `${this.moduleName}-`
    return Array.from(this.activeTimers.keys())
      .filter((key) => key.startsWith(modulePrefix))
      .map((key) => key.substring(modulePrefix.length))
  }

  /**
   * Nettoyer tous les timers actifs
   */
  clearActiveTimers(): void {
    const modulePrefix = `${this.moduleName}-`
    for (const key of this.activeTimers.keys()) {
      if (key.startsWith(modulePrefix)) {
        this.activeTimers.delete(key)
      }
    }
  }

  /**
   * Configuration globale pour tous les loggers
   */
  static configureAll(config: Partial<LoggerConfig>): void {
    for (const instance of UnifiedLogger.instances.values()) {
      instance.configure(config)
    }
  }

  /**
   * Obtenir toutes les instances actives
   */
  static getAllInstances(): Map<string, UnifiedLogger> {
    return new Map(UnifiedLogger.instances)
  }
}

// ===============================
// factory Factory Functions (DRY Exports)
// ===============================

/**
 * Créateurs de loggers standardisés pour remplacer les anciens
 */
export const createModuleLogger = (
  moduleName: string,
  config?: Partial<LoggerConfig>
) => UnifiedLogger.getInstance(moduleName, config)

// Instances pré-configurées pour compatibilité
export const logger = UnifiedLogger.getInstance('core')
export const adapterLogger = UnifiedLogger.getInstance('adapter')
export const quantizerLogger = UnifiedLogger.getInstance('quantizer')
export const paletteLogger = UnifiedLogger.getInstance('palette')
export const webglLogger = UnifiedLogger.getInstance('webgl')
export const reglLogger = UnifiedLogger.getInstance('regl')
export const factoryLogger = UnifiedLogger.getInstance('factory')

// Utilitaires globaux
export const performance = {
  quantization: <T>(fn: () => T): T =>
    quantizerLogger.timeSync('Total Quantization', fn),
  adaptation: <T>(fn: () => T): T =>
    adapterLogger.timeSync('Processor Adaptation', fn),
  webgl: <T>(fn: () => T): T => webglLogger.timeSync('WebGL Operation', fn),
  palette: <T>(fn: () => T): T =>
    paletteLogger.timeSync('Palette Generation', fn),
  factory: <T>(fn: () => T): T =>
    factoryLogger.timeSync('Factory Operation', fn)
}

/**
 * quantizer AVANTAGES DE CETTE REFACTORISATION DRY:
 *
 * 1. **Élimination Duplication**: 6 loggers → 1 classe réutilisable
 * 2. **Configuration Centralisée**: Une seule source de vérité
 * 3. **Interface Cohérente**: Méthodes standardisées partout
 * 4. **Maintenance Simplifiée**: Modifications une seule fois
 * 5. **Type Safety**: Interface stricte TypeScript
 * 6. **Performance**: Singleton pattern + optimisations
 * 7. **Extensibilité**: Facile d'ajouter de nouveaux modules
 * 8. **Testabilité**: Logique centralisée = tests centralisés
 */
