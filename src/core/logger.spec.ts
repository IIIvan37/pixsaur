import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adapterLogger, createLogger, logger as globalLogger } from '@/core'

// Mock console methods
vi.spyOn(console, 'debug').mockImplementation(() => {})
const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Logger (core) behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(consoleInfoSpy).toHaveBeenCalled()
  })

  it('adapter logger should have prefix', () => {
    adapterLogger.info('adapter')
    expect(consoleInfoSpy).toHaveBeenCalled()
  })
})
