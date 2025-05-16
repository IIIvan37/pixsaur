// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncWrap<T extends (...args: any[]) => any>(
  fn: T,
  delay = 0
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>) => {
    await Promise.resolve()
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    return fn(...args)
  }
}
