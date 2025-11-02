/**
 * Assert that a condition is truthy, throwing an error if not.
 * Useful for type narrowing and runtime validation.
 *
 * @param condition - The condition to check
 * @param message - Error message to throw if condition is falsy
 * @throws Error if condition is falsy
 *
 * @example
 * ```ts
 * const value: string | null = getValue()
 * invariant(value !== null, 'Value must not be null')
 * // TypeScript now knows value is string
 * ```
 */
export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}
