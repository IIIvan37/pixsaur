/**
 * Assert that a condition is truthy, throwing an error if not.
 * Useful for type narrowing and runtime validation.
 */
export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}
