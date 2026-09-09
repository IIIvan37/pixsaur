import { act, renderHook, waitFor } from '@testing-library/react'
import { atom, createStore, Provider } from 'jotai'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { useDebouncedPersistence } from './use-debounced-persistence'

const stateAtom = atom<string | null>(null)
const restoreAtom = atom(null, (_get, set, saved: string) =>
  set(stateAtom, saved)
)

function wrapperOf(atoms: ReturnType<typeof createStore>) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={atoms}>{children}</Provider>
  )
}

const filled = (state: string | null) => state !== null

describe('useDebouncedPersistence', () => {
  it('reopens the workshop on what was saved', async () => {
    const atoms = createStore()

    renderHook(
      () =>
        useDebouncedPersistence({
          capture: stateAtom,
          restore: restoreAtom,
          storage: { load: () => 'saved', save: () => {} }
        }),
      { wrapper: wrapperOf(atoms) }
    )

    await waitFor(() => expect(atoms.get(stateAtom)).toBe('saved'))
  })

  it('leaves alone what the user put there first', async () => {
    const atoms = createStore()
    atoms.set(stateAtom, 'theirs')

    renderHook(
      () =>
        useDebouncedPersistence({
          capture: stateAtom,
          restore: restoreAtom,
          storage: { load: () => 'saved', save: () => {} },
          hasContent: filled
        }),
      { wrapper: wrapperOf(atoms) }
    )

    await waitFor(() => expect(atoms.get(stateAtom)).toBe('theirs'))
  })

  it('writes a change back once the user pauses', async () => {
    const atoms = createStore()
    const save = vi.fn()

    renderHook(
      () =>
        useDebouncedPersistence({
          capture: stateAtom,
          restore: restoreAtom,
          storage: { load: () => null, save }
        }),
      { wrapper: wrapperOf(atoms) }
    )
    // Let the load settle first: saving only starts once it has.
    await act(async () => {})
    act(() => atoms.set(stateAtom, 'changed'))

    await waitFor(() => expect(save).toHaveBeenCalledWith('changed'), {
      timeout: 3000
    })
  })

  it('never writes back an empty workshop', async () => {
    const atoms = createStore()
    const save = vi.fn()

    renderHook(
      () =>
        useDebouncedPersistence({
          capture: stateAtom,
          restore: restoreAtom,
          storage: { load: () => null, save }
        }),
      { wrapper: wrapperOf(atoms) }
    )
    await act(async () => {})

    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(save).not.toHaveBeenCalled()
  })
})
