import { create } from 'zustand'
import { shallow } from 'zustand/shallow'

type SafeSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void

export function createSafeStore<T>(
  initializer: (set: SafeSetter<T>, get: () => T) => T
) {
  return create<T>()((set, get) => {
    const safeSet: SafeSetter<T> = (key, value) => {
      const current = get()[key]
      const isSame = shallow(value, current)
      if (!isSame) {
        set({ [key]: value } as unknown as Partial<T>)
      }
    }

    return initializer(safeSet, get)
  })
}
