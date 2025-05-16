import { AdjustementKey } from '@/app/store/config/types'

export type RangeOption = Record<
  AdjustementKey,
  [value: number, min: number, max: number, step: number]
>
