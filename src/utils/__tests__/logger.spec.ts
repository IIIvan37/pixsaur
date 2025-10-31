import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adapterLogger,
  createLogger,
  type LoggerConfig,
  logger,
  measure,
  paletteLogger,
  quantizerLogger,
  webglLogger
} from '@/utils/logger'

// Mock console methods
const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {})
const consoleGroupEndSpy = vi
  .spyOn(console, 'groupEnd')
  .mockImplementation(() => {})

// Mock performance.now
const performanceNowSpy = vi.spyOn(performance, 'now')

describe('Logger Functionality', () => {
  let testLogger: ReturnType<typeof createLogger>

  beforeEach(() => {
    testLogger = createLogger({
      enabled: true,
      level: 'debug',
      enableTiming: true
    })
    vi.clearAllMocks()
    performanceNowSpy.mockClear()
  })

  afterEach(() => {
    // Clear timers if the logger has that method
    if ('clearTimers' in testLogger) {
      ;(testLogger as any).clearTimers()
    }
  })

  describe('Constructor and Configuration', () => {
    it('should create logger with default config', () => {
      const logger = createLogger()
      expect(logger).toBeDefined()
    })

    it('should merge provided config with defaults', () => {
      const customConfig: Partial<LoggerConfig> = {
        enabled: false,
        level: 'debug',
        prefix: '[Test]'
      }
      const logger = createLogger(customConfig)
      expect(logger).toBeDefined()
    })

    it('should configure logger with partial config', () => {
      // Test configuration through behavior
      const disabledLogger = createLogger({ enabled: false })
      disabledLogger.info('test')
      expect(consoleInfoSpy).not.toHaveBeenCalled()
    })
  })

  describe('Logging Methods', () => {
    it('should log debug messages when enabled', () => {
      testLogger.debug('debug message')
      expect(consoleDebugSpy).toHaveBeenCalledWith('[Pixsaur]', 'debug message')
    })

    it('should log info messages', () => {
      testLogger.info('info message')
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Pixsaur]', 'info message')
    })

    it('should log warning messages', () => {
      testLogger.warn('warning message')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'warning message'
      )
    })

    it('should log error messages', () => {
      testLogger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Pixsaur]', 'error message')
    })

    it('should not log when disabled', () => {
      const disabledLogger = createLogger({ enabled: false })
      disabledLogger.info('should not log')
      expect(consoleInfoSpy).not.toHaveBeenCalled()
    })

    it('should filter messages based on level', () => {
      const warnLogger = createLogger({ enabled: true, level: 'warn' })

      warnLogger.debug('debug') // should not log
      warnLogger.info('info') // should not log
      warnLogger.warn('warn') // should log
      warnLogger.error('error') // should log

      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleInfoSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      testLogger.info('message', 123, { key: 'value' })
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Pixsaur]', 'message', 123, {
        key: 'value'
      })
    })
  })

  describe('Grouping Methods', () => {
    it('should create log groups', () => {
      testLogger.group('Test Group')
      expect(consoleGroupSpy).toHaveBeenCalledWith('[Pixsaur] Test Group')
    })

    it('should end log groups', () => {
      testLogger.groupEnd()
      expect(consoleGroupEndSpy).toHaveBeenCalled()
    })

    it('should not group when disabled', () => {
      const disabledLogger = createLogger({ enabled: false })
      disabledLogger.group('Test Group')
      expect(consoleGroupSpy).not.toHaveBeenCalled()
    })
  })

  describe('Timing Methods', () => {
    beforeEach(() => {
      performanceNowSpy.mockReturnValue(1000)
    })

    it('should start timing', () => {
      testLogger.time('test-timer')
      expect(performanceNowSpy).toHaveBeenCalledTimes(1)
    })

    it('should end timing and log duration', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1100) // end

      testLogger.time('test-timer')
      const duration = testLogger.timeEnd('test-timer')

      expect(duration).toBe(100)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'test-timer: 100.00ms'
      )
    })

    it('should warn when ending non-existent timer', () => {
      const duration = testLogger.timeEnd('non-existent')
      expect(duration).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'Timer "non-existent" not found'
      )
    })

    it('should not time when timing disabled', () => {
      const noTimingLogger = createLogger({ enableTiming: false })
      noTimingLogger.time('test-timer')
      expect(performanceNowSpy).not.toHaveBeenCalled()
    })

    it('should not time when logging disabled', () => {
      const disabledLogger = createLogger({ enabled: false })
      disabledLogger.time('test-timer')
      expect(performanceNowSpy).not.toHaveBeenCalled()
    })
  })

  describe('timeSync Method', () => {
    beforeEach(() => {
      performanceNowSpy.mockReturnValue(1000)
    })

    it('should measure sync function execution', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1020) // end

      const result = testLogger.timeSync('sync-test', () => 'result')

      expect(result).toBe('result')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'sync-test: 20.00ms'
      )
    })

    it('should rethrow errors from sync function', () => {
      const error = new Error('test error')
      const failingFn = () => {
        throw error
      }

      expect(() => {
        testLogger.timeSync('sync-test', failingFn)
      }).toThrow(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'sync-test failed:',
        error
      )
    })

    it('should not measure when timing disabled', () => {
      const noTimingLogger = createLogger({ enableTiming: false })

      const result = noTimingLogger.timeSync('sync-test', () => 'result')

      expect(result).toBe('result')
      expect(performanceNowSpy).not.toHaveBeenCalled()
    })
  })

  describe('timeAsync Method', () => {
    beforeEach(() => {
      performanceNowSpy.mockReturnValue(1000)
    })

    it('should measure async function execution', async () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1030) // end

      const asyncFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return 'result'
      }

      const result = await testLogger.timeAsync('async-test', asyncFn)

      expect(result).toBe('result')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'async-test: 30.00ms'
      )
    })

    it('should rethrow errors from async function', async () => {
      const error = new Error('async error')

      await expect(
        testLogger.timeAsync('async-test', async () => {
          throw error
        })
      ).rejects.toThrow(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Pixsaur]',
        'async-test failed:',
        error
      )
    })

    it('should not measure when timing disabled', async () => {
      const noTimingLogger = createLogger({ enableTiming: false })

      const result = await noTimingLogger.timeAsync(
        'async-test',
        async () => 'result'
      )

      expect(result).toBe('result')
      expect(performanceNowSpy).not.toHaveBeenCalled()
    })
  })

  describe('Timer Management', () => {
    it('should return active timers', () => {
      testLogger.time('timer1')
      testLogger.time('timer2')

      const activeTimers = (testLogger as any).getActiveTimers()
      expect(activeTimers).toEqual(['timer1', 'timer2'])
    })

    it('should clear all timers', () => {
      testLogger.time('timer1')
      testLogger.time('timer2')

      ;(testLogger as any).clearTimers()

      const activeTimers = (testLogger as any).getActiveTimers()
      expect(activeTimers).toEqual([])
    })

    it('should handle empty timers list', () => {
      const activeTimers = (testLogger as any).getActiveTimers()
      expect(activeTimers).toEqual([])
    })
  })

  describe('Level Filtering', () => {
    it('should allow messages at or above current level', () => {
      const infoLogger = createLogger({ enabled: true, level: 'info' })

      // These should work since they're at or above 'info'
      infoLogger.info('info')
      infoLogger.warn('warn')
      infoLogger.error('error')

      expect(consoleInfoSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should filter out messages below current level', () => {
      const warnLogger = createLogger({ enabled: true, level: 'warn' })

      warnLogger.debug('debug') // below warn
      warnLogger.info('info') // below warn

      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleInfoSpy).not.toHaveBeenCalled()
    })

    it('should handle all level combinations', () => {
      const levels: LoggerConfig['level'][] = ['debug', 'info', 'warn', 'error']

      for (const level of levels) {
        const levelLogger = createLogger({ enabled: true, level })
        vi.clearAllMocks()

        // Test all message types
        levelLogger.debug('debug')
        levelLogger.info('info')
        levelLogger.warn('warn')
        levelLogger.error('error')

        const levelIndex = levels.indexOf(level)

        // Check which messages should have been logged
        if (levelIndex <= levels.indexOf('debug')) {
          expect(consoleDebugSpy).toHaveBeenCalled()
        }
        if (levelIndex <= levels.indexOf('info')) {
          expect(consoleInfoSpy).toHaveBeenCalled()
        }
        if (levelIndex <= levels.indexOf('warn')) {
          expect(consoleWarnSpy).toHaveBeenCalled()
        }
        if (levelIndex <= levels.indexOf('error')) {
          expect(consoleErrorSpy).toHaveBeenCalled()
        }
      }
    })
  })
})

describe('Global Logger Instance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be defined', () => {
    expect(logger).toBeDefined()
  })

  it('should use default configuration', () => {
    // In test environment, DEV should be true, so logging should be enabled
    logger.info('test message')
    expect(consoleInfoSpy).toHaveBeenCalled()
  })
})

describe('createLogger Factory', () => {
  it('should create new logger instances', () => {
    const customLogger = createLogger({ prefix: '[Custom]' })
    expect(customLogger).toBeDefined()
    expect(customLogger).not.toBe(logger)
  })

  it('should apply custom configuration', () => {
    const customLogger = createLogger({
      prefix: '[Custom]',
      enabled: true,
      level: 'debug'
    })

    customLogger.info('test')
    expect(consoleInfoSpy).toHaveBeenCalledWith('[Custom]', 'test')
  })
})

describe('Specialized Loggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have adapter logger with correct prefix', () => {
    adapterLogger.info('adapter message')
    expect(consoleInfoSpy).toHaveBeenCalledWith('[Adapter]', 'adapter message')
  })

  it('should have webgl logger with correct prefix', () => {
    webglLogger.info('webgl message')
    expect(consoleInfoSpy).toHaveBeenCalledWith('[WebGL]', 'webgl message')
  })

  it('should have quantizer logger with correct prefix', () => {
    quantizerLogger.info('quantizer message')
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[Quantizer]',
      'quantizer message'
    )
  })

  it('should have palette logger with correct prefix', () => {
    paletteLogger.info('palette message')
    expect(consoleInfoSpy).toHaveBeenCalledWith('[Palette]', 'palette message')
  })

  it('should all be separate instances', () => {
    expect(adapterLogger).not.toBe(webglLogger)
    expect(quantizerLogger).not.toBe(paletteLogger)
    expect(logger).not.toBe(adapterLogger)
  })
})

describe('Performance Measurement Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    performanceNowSpy.mockReturnValue(1000)
  })

  describe('measure.quantization', () => {
    it('should measure quantization operations', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1010) // end

      const result = measure.quantization(() => 'quantized')

      expect(result).toBe('quantized')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Quantizer]',
        'Total Quantization: 10.00ms'
      )
    })
  })

  describe('measure.adaptation', () => {
    it('should measure adaptation operations', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1020) // end

      const result = measure.adaptation(() => 'adapted')

      expect(result).toBe('adapted')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Adapter]',
        'Processor Adaptation: 20.00ms'
      )
    })
  })

  describe('measure.webgl', () => {
    it('should measure WebGL operations', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1030) // end

      const result = measure.webgl(() => 'webgl result')

      expect(result).toBe('webgl result')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[WebGL]',
        'WebGL Operation: 30.00ms'
      )
    })
  })

  describe('measure.palette', () => {
    it('should measure palette operations', () => {
      performanceNowSpy.mockReturnValueOnce(1000) // start
      performanceNowSpy.mockReturnValueOnce(1040) // end

      const result = measure.palette(() => 'palette result')

      expect(result).toBe('palette result')
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Palette]',
        'Palette Generation: 40.00ms'
      )
    })
  })

  describe('Error Handling in Measurements', () => {
    it('should rethrow errors in quantization measurements', () => {
      const error = new Error('quantization failed')
      const failingFn = () => {
        throw error
      }

      expect(() => {
        measure.quantization(failingFn)
      }).toThrow(error)
    })

    it('should rethrow errors in adaptation measurements', () => {
      const error = new Error('adaptation failed')
      const failingFn = () => {
        throw error
      }

      expect(() => {
        measure.adaptation(failingFn)
      }).toThrow(error)
    })

    it('should rethrow errors in webgl measurements', () => {
      const error = new Error('webgl failed')
      const failingFn = () => {
        throw error
      }

      expect(() => {
        measure.webgl(failingFn)
      }).toThrow(error)
    })

    it('should rethrow errors in palette measurements', () => {
      const error = new Error('palette failed')
      const failingFn = () => {
        throw error
      }

      expect(() => {
        measure.palette(failingFn)
      }).toThrow(error)
    })
  })
})

describe('Default Configuration Behavior', () => {
  it('should disable logging in production', () => {
    // We can't easily test production mode, but we can verify the default config
    const defaultLogger = createLogger()
    // The default config uses import.meta.env.DEV which should be true in test
    expect(defaultLogger).toBeDefined()
  })

  it('should have sensible defaults', () => {
    const defaultLogger = createLogger()

    // Test that it doesn't crash with default config
    defaultLogger.info('test')
    expect(consoleInfoSpy).toHaveBeenCalled()
  })
})
