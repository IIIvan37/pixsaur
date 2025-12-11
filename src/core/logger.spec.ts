import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adapterLogger, createLogger, logger as globalLogger } from '@/core'

describe('Logger (core) behavior', () => {
  let consoleSpy: {
    debug: MockInstance
    info: MockInstance
    warn: MockInstance
    error: MockInstance
    group: MockInstance
    groupEnd: MockInstance
  }

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should be defined', () => {
    expect(globalLogger).toBeDefined()
  })

  it('createLogger should allow custom configs', () => {
    const custom = createLogger({
      prefix: '[Custom]',
      enabled: true,
      level: 'debug'
    })
    custom.info('test')
    expect(consoleSpy.info).toHaveBeenCalled()
  })

  it('adapter logger should have prefix', () => {
    adapterLogger.info('adapter')
    expect(consoleSpy.info).toHaveBeenCalled()
  })

  describe('configure', () => {
    it('should update logger configuration', () => {
      const logger = createLogger({ enabled: true, prefix: '[Test]' })

      logger.info('before')
      expect(consoleSpy.info).toHaveBeenCalledWith('[Test]', 'before')

      logger.configure({ prefix: '[Updated]' })
      logger.info('after')
      expect(consoleSpy.info).toHaveBeenCalledWith('[Updated]', 'after')
    })

    it('should allow enabling/disabling logger', () => {
      const logger = createLogger({ enabled: false })

      logger.info('should not log')
      expect(consoleSpy.info).not.toHaveBeenCalled()

      logger.configure({ enabled: true })
      logger.info('should log')
      expect(consoleSpy.info).toHaveBeenCalled()
    })
  })

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      const logger = createLogger({
        enabled: true,
        level: 'debug',
        prefix: '[Test]'
      })

      logger.debug('debug message')
      expect(consoleSpy.debug).toHaveBeenCalledWith('[Test]', 'debug message')
    })

    it('should not log debug messages when level is info', () => {
      const logger = createLogger({
        enabled: true,
        level: 'info',
        prefix: '[Test]'
      })

      logger.debug('debug message')
      expect(consoleSpy.debug).not.toHaveBeenCalled()
    })

    it('should log info messages', () => {
      const logger = createLogger({
        enabled: true,
        level: 'info',
        prefix: '[Test]'
      })

      logger.info('info message')
      expect(consoleSpy.info).toHaveBeenCalledWith('[Test]', 'info message')
    })

    it('should log warn messages', () => {
      const logger = createLogger({
        enabled: true,
        level: 'warn',
        prefix: '[Test]'
      })

      logger.warn('warn message')
      expect(consoleSpy.warn).toHaveBeenCalledWith('[Test]', 'warn message')
    })

    it('should log error messages', () => {
      const logger = createLogger({
        enabled: true,
        level: 'error',
        prefix: '[Test]'
      })

      logger.error('error message')
      expect(consoleSpy.error).toHaveBeenCalledWith('[Test]', 'error message')
    })

    it('should respect log level hierarchy', () => {
      const logger = createLogger({
        enabled: true,
        level: 'warn',
        prefix: '[Test]'
      })

      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      expect(consoleSpy.debug).not.toHaveBeenCalled()
      expect(consoleSpy.info).not.toHaveBeenCalled()
      expect(consoleSpy.warn).toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalled()
    })
  })

  describe('disabled logging', () => {
    it('should not log when disabled', () => {
      const logger = createLogger({ enabled: false })

      logger.debug('test')
      logger.info('test')
      logger.warn('test')
      logger.error('test')

      expect(consoleSpy.debug).not.toHaveBeenCalled()
      expect(consoleSpy.info).not.toHaveBeenCalled()
      expect(consoleSpy.warn).not.toHaveBeenCalled()
      expect(consoleSpy.error).not.toHaveBeenCalled()
    })
  })

  describe('timing', () => {
    it('should track timers', () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      logger.time('test-timer')
      expect(logger.getActiveTimers()).toContain('test-timer')
    })

    it('should return duration on timeEnd', () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      logger.time('test-timer')
      const duration = logger.timeEnd('test-timer')

      expect(duration).toBeGreaterThanOrEqual(0)
      expect(logger.getActiveTimers()).not.toContain('test-timer')
    })

    it('should warn when timer not found', () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      logger.timeEnd('nonexistent')

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Test]',
        'Timer "nonexistent" not found'
      )
    })

    it('should not track timers when timing is disabled', () => {
      const logger = createLogger({ enabled: true, enableTiming: false })

      logger.time('test-timer')
      expect(logger.getActiveTimers()).toHaveLength(0)
    })

    it('should clear all timers', () => {
      const logger = createLogger({ enabled: true, enableTiming: true })

      logger.time('timer1')
      logger.time('timer2')
      expect(logger.getActiveTimers()).toHaveLength(2)

      logger.clearTimers()
      expect(logger.getActiveTimers()).toHaveLength(0)
    })

    it('should not start timer when disabled', () => {
      const logger = createLogger({ enabled: false, enableTiming: true })

      logger.time('test-timer')
      expect(logger.getActiveTimers()).toHaveLength(0)
    })

    it('should return undefined on timeEnd when disabled', () => {
      const logger = createLogger({ enabled: false, enableTiming: true })

      const result = logger.timeEnd('test')
      expect(result).toBeUndefined()
    })
  })

  describe('timeSync', () => {
    it('should measure synchronous function execution', () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      const result = logger.timeSync('sync-op', () => {
        return 42
      })

      expect(result).toBe(42)
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('should handle errors in sync function', () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      expect(() => {
        logger.timeSync('failing-op', () => {
          throw new Error('test error')
        })
      }).toThrow('test error')

      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('should execute function even when timing is disabled', () => {
      const logger = createLogger({ enabled: false })

      const result = logger.timeSync('disabled', () => 123)

      expect(result).toBe(123)
    })
  })

  describe('timeAsync', () => {
    it('should measure async function execution', async () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      const result = await logger.timeAsync('async-op', async () => {
        return 'async result'
      })

      expect(result).toBe('async result')
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('should handle errors in async function', async () => {
      const logger = createLogger({
        enabled: true,
        enableTiming: true,
        prefix: '[Test]'
      })

      await expect(
        logger.timeAsync('failing-async', async () => {
          throw new Error('async error')
        })
      ).rejects.toThrow('async error')

      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('should execute function even when timing is disabled', async () => {
      const logger = createLogger({ enabled: false })

      const result = await logger.timeAsync('disabled', async () => 'result')

      expect(result).toBe('result')
    })
  })

  describe('grouping', () => {
    it('should create log groups', () => {
      const logger = createLogger({ enabled: true, prefix: '[Test]' })

      logger.group('My Group')
      expect(consoleSpy.group).toHaveBeenCalledWith('[Test] My Group')
    })

    it('should close log groups', () => {
      const logger = createLogger({ enabled: true })

      logger.groupEnd()
      expect(consoleSpy.groupEnd).toHaveBeenCalled()
    })

    it('should not create groups when disabled', () => {
      const logger = createLogger({ enabled: false })

      logger.group('Test')
      logger.groupEnd()

      expect(consoleSpy.group).not.toHaveBeenCalled()
      expect(consoleSpy.groupEnd).not.toHaveBeenCalled()
    })
  })

  describe('multiple arguments', () => {
    it('should pass multiple arguments to console', () => {
      const logger = createLogger({ enabled: true, prefix: '[Test]' })

      logger.info('message', { data: 123 }, 'more')

      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[Test]',
        'message',
        { data: 123 },
        'more'
      )
    })
  })
})
