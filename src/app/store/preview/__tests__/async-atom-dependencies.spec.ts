/**
 * Pins the Jotai property the preview pipeline relies on.
 *
 * Roughly 45 `get(...)` calls in `store/preview/**` happen *after* an
 * `await get(...)` — `previewImageAtom` awaits three atoms then reads four
 * config atoms, `quantizedPaletteAtom` awaits twice then reads seven. The
 * architecture review (candidate 7, August 2026) read that as a tracking bug
 * and proposed a `deriveAsync` helper to force every read up front.
 *
 * It is not a bug: Jotai registers a dependency whenever the read function
 * calls `get`, including after the function has suspended. These tests are the
 * guard on that — if a Jotai upgrade ever narrows tracking to the synchronous
 * prefix, this file goes red before the preview silently stops recomputing.
 */

import { atom, createStore } from 'jotai'

/** Same shape as `previewImageAtom`: await upstream, then read config. */
function pipelineAtoms() {
  const upstream = atom(
    async () =>
      new Promise<number>((resolve) => setTimeout(() => resolve(1), 5))
  )
  const configRead = atom(10)
  const derived = atom(async (get) => {
    const value = await get(upstream)
    return value + get(configRead)
  })
  return { configRead, derived }
}

describe('post-await dependency tracking', () => {
  it('recomputes when a config atom read after the await changes', async () => {
    const { configRead, derived } = pipelineAtoms()
    const store = createStore()
    await store.get(derived)

    store.set(configRead, 20)

    expect(await store.get(derived)).toBe(21)
  })

  it('notifies subscribers when a config atom read after the await changes', async () => {
    const { configRead, derived } = pipelineAtoms()
    const store = createStore()
    const values: number[] = []
    const unsubscribe = store.sub(derived, () => {
      store.get(derived).then((v) => values.push(v))
    })
    await store.get(derived)

    store.set(configRead, 20)
    await store.get(derived)
    unsubscribe()

    expect(values).toContain(21)
  })

  it('tracks reads that follow several awaits', async () => {
    const first = atom(async () => 1)
    const second = atom(async () => 2)
    const configRead = atom(10)
    const derived = atom(
      async (get) => (await get(first)) + (await get(second)) + get(configRead)
    )
    const store = createStore()
    await store.get(derived)

    store.set(configRead, 20)

    expect(await store.get(derived)).toBe(23)
  })

  it('drops a dependency the read no longer reaches', async () => {
    // The early `if (!quantizer || !normalized) return null` guards mean some
    // config atoms are not read on every pass. Jotai must not keep stale edges.
    const gate = atom(true)
    const conditional = atom(10)
    let reads = 0
    const derived = atom(async (get) => {
      await Promise.resolve()
      if (!get(gate)) return 0
      reads++
      return get(conditional)
    })
    const store = createStore()
    const unsubscribe = store.sub(derived, () => {})
    await store.get(derived)
    store.set(gate, false)
    await store.get(derived)

    store.set(conditional, 20)
    await store.get(derived)
    unsubscribe()

    expect(reads).toBe(1)
  })
})
