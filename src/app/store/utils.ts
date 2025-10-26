import { atomWithReducer } from 'jotai/utils'

export function atomWithCompare<Value>(
  initialValue: Value,
  areEqual: (prev: Value, next: Value) => boolean
) {
  return atomWithReducer(initialValue, (prev: Value, next: Value) => {
    if (areEqual(prev, next)) {
      return prev
    }

    return next
  })
}
