import { describe, expect, it } from 'vitest'
import { invariant } from './invariant'

describe('invariant', () => {
  it('should not throw when condition is truthy', () => {
    expect(() => invariant(true, 'Should not throw')).not.toThrow()
    expect(() => invariant(1, 'Should not throw')).not.toThrow()
    expect(() => invariant('string', 'Should not throw')).not.toThrow()
    expect(() => invariant({}, 'Should not throw')).not.toThrow()
  })

  it('should throw when condition is falsy', () => {
    expect(() => invariant(false, 'Expected error')).toThrow('Expected error')
    expect(() => invariant(0, 'Zero is falsy')).toThrow('Zero is falsy')
    expect(() => invariant('', 'Empty string')).toThrow('Empty string')
    expect(() => invariant(null, 'Null value')).toThrow('Null value')
    expect(() => invariant(undefined, 'Undefined')).toThrow('Undefined')
  })

  it('should throw Error instance', () => {
    try {
      invariant(false, 'Test error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Test error')
    }
  })

  it('should work with type narrowing', () => {
    const value: string | null = 'test'
    invariant(value !== null, 'Value must not be null')
    // TypeScript should now know value is string
    const length: number = value.length
    expect(length).toBe(4)
  })

  it('should work with typeof checks', () => {
    const value: unknown = 'test'
    invariant(typeof value === 'string', 'Value must be string')
    // TypeScript should now know value is string
    expect(value.toUpperCase()).toBe('TEST')
  })
})
