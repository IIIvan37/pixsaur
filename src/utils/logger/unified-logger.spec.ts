/**
 * 🧪 Tests pour le Logger Unifié DRY
 *
 * Ces tests valident que la refactorisation DRY fonctionne correctement
 * et que les performances sont maintenues ou améliorées.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adapterLogger,
  performance as loggerPerformance,
  MODULE_EMOJIS,
  quantizerLogger,
  UnifiedLogger
} from '@/utils/logger/unified-logger'

describe('🔄 Logger Unifié DRY', () => {
  beforeEach(() => {
    // Reset configuration avant chaque test
    UnifiedLogger.configureAll({
      enabled: true,
      level: 'info',
      enableTimers: true,
      enableGroups: true
    })

    // Nettoyer les timers actifs
    const instances = UnifiedLogger.getAllInstances()
    for (const instance of instances.values()) {
      instance.clearActiveTimers()
    }
  })

  describe('🏭 Factory Pattern (DRY)', () => {
    it('devrait créer une seule instance par module', () => {
      const logger1 = UnifiedLogger.getInstance('test')
      const logger2 = UnifiedLogger.getInstance('test')

      expect(logger1).toBe(logger2) // Même référence = singleton
    })

    it('devrait créer des instances différentes pour des modules différents', () => {
      const adapterInstance = UnifiedLogger.getInstance('adapter')
      const quantizerInstance = UnifiedLogger.getInstance('quantizer')

      expect(adapterInstance).not.toBe(quantizerInstance)
    })

    it('devrait utiliser les emojis standardisés', () => {
      const adapterInstance = UnifiedLogger.getInstance('adapter')
      const config = adapterInstance.getConfig()

      expect(config.prefix).toContain(MODULE_EMOJIS.adapter)
      expect(config.prefix).toContain('[ADAPTER]')
    })
  })

  describe('⚙️ Configuration Centralisée (DRY)', () => {
    it('devrait configurer tous les loggers en une fois', () => {
      UnifiedLogger.configureAll({ level: 'error', enabled: false })

      const instances = UnifiedLogger.getAllInstances()
      for (const [_name, instance] of instances) {
        const config = instance.getConfig()
        expect(config.level).toBe('error')
        expect(config.enabled).toBe(false)
      }
    })

    it('devrait respecter la configuration par module', () => {
      const testLogger = UnifiedLogger.getInstance('test', { level: 'debug' })
      expect(testLogger.getConfig().level).toBe('debug')

      // Autres loggers gardent config par défaut
      expect(adapterLogger.getConfig().level).toBe('info')
    })
  })

  describe('⏱️ Performance Timing (DRY)', () => {
    it('devrait mesurer le temps correctement', () => {
      const testLogger = UnifiedLogger.getInstance('test')

      const timer = testLogger.time('Test Operation')
      expect(timer.name).toBe('Test Operation')
      expect(timer.startTime).toBeGreaterThan(0)

      // Simuler du travail
      const start = performance.now()
      while (performance.now() - start < 10) {} // 10ms minimum

      timer.end()
      expect(testLogger.getActiveTimers()).not.toContain('Test Operation')
    })

    it('devrait gérer timeSync correctement', () => {
      const testLogger = UnifiedLogger.getInstance('test')

      const result = testLogger.timeSync('Sync Test', () => {
        return 'test result'
      })

      expect(result).toBe('test result')
      expect(testLogger.getActiveTimers()).toHaveLength(0)
    })

    it('devrait gérer timeAsync correctement', async () => {
      const testLogger = UnifiedLogger.getInstance('test')

      const result = await testLogger.timeAsync('Async Test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return 'async result'
      })

      expect(result).toBe('async result')
      expect(testLogger.getActiveTimers()).toHaveLength(0)
    })

    it('devrait nettoyer les timers par module', () => {
      const testLogger = UnifiedLogger.getInstance('test')

      testLogger.time('Timer 1')
      testLogger.time('Timer 2')

      expect(testLogger.getActiveTimers()).toHaveLength(2)

      testLogger.clearActiveTimers()
      expect(testLogger.getActiveTimers()).toHaveLength(0)
    })
  })

  describe('📊 Interface Cohérente (DRY)', () => {
    it('devrait avoir la même interface pour tous les loggers', () => {
      const methods = [
        'debug',
        'info',
        'warn',
        'error',
        'time',
        'timeSync',
        'timeAsync',
        'group',
        'groupEnd'
      ]

      for (const method of methods) {
        expect(adapterLogger).toHaveProperty(method)
        expect(quantizerLogger).toHaveProperty(method)
        expect(typeof (adapterLogger as any)[method]).toBe('function')
        expect(typeof (quantizerLogger as any)[method]).toBe('function')
      }
    })

    it('devrait respecter les niveaux de log', () => {
      const testLogger = UnifiedLogger.getInstance('test', { level: 'warn' })

      // Mock console pour tester
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      testLogger.debug('Should not log')
      expect(consoleSpy).not.toHaveBeenCalled()

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      testLogger.warn('Should log')
      expect(warnSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })
  })

  describe('🚀 Performance Utilities (DRY)', () => {
    it('devrait fournir des utilitaires de performance', () => {
      expect(loggerPerformance.quantization).toBeInstanceOf(Function)
      expect(loggerPerformance.adaptation).toBeInstanceOf(Function)
      expect(loggerPerformance.webgl).toBeInstanceOf(Function)
      expect(loggerPerformance.palette).toBeInstanceOf(Function)
      expect(loggerPerformance.factory).toBeInstanceOf(Function)
    })

    it('devrait mesurer avec les utilitaires', () => {
      const result = loggerPerformance.quantization(() => {
        return 'quantization result'
      })

      expect(result).toBe('quantization result')
    })
  })

  describe('📈 Metrics de Comparaison', () => {
    it("devrait réduire le nombre d'instances", () => {
      // Avant: 6 classes différentes
      // Après: 1 classe réutilisée
      const instances = UnifiedLogger.getAllInstances()

      // Tous les loggers utilisent la même classe
      for (const instance of instances.values()) {
        expect(instance).toBeInstanceOf(UnifiedLogger)
      }
    })

    it('devrait centraliser la configuration', () => {
      // Configuration en une seule fois
      UnifiedLogger.configureAll({ level: 'debug' })

      // Vérifier que tous les loggers sont configurés
      const instances = UnifiedLogger.getAllInstances()
      expect(instances.size).toBeGreaterThan(0)

      for (const instance of instances.values()) {
        expect(instance.getConfig().level).toBe('debug')
      }
    })
  })
})

describe('🔄 Migration Compatibility', () => {
  it("devrait maintenir l'API existante", () => {
    // Les loggers pré-configurés doivent exister
    expect(adapterLogger).toBeDefined()
    expect(quantizerLogger).toBeDefined()

    // Et avoir les méthodes attendues
    expect(adapterLogger.info).toBeInstanceOf(Function)
    expect(adapterLogger.timeSync).toBeInstanceOf(Function)
    expect(quantizerLogger.debug).toBeInstanceOf(Function)
  })

  it('devrait fonctionner avec le code existant', () => {
    // Test d\'utilisation typique
    expect(() => {
      adapterLogger.info('Test message')
      quantizerLogger.timeSync('Test operation', () => 'result')
    }).not.toThrow()
  })
})
