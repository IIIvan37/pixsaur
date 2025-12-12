/**
 * Image adjustments component (smart component with hooks)
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  configAtom,
  resetImageAdjustmentsAtom,
  setComponentAtom
} from '@/app/store/config/config'
import type { AdjustementKey } from '@/app/store/config/types'
import { workingImageAtom } from '@/app/store/image/image'
import { ImageAdjustmentsView } from './image-adjustments-view'

export function ImageAdjustments() {
  const config = useAtomValue(configAtom)
  const setComponent = useSetAtom(setComponentAtom)
  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const workingImage = useAtomValue(workingImageAtom)
  const disabled = !workingImage?.data

  const handleValueChange = (key: AdjustementKey, value: number) => {
    setComponent({ key, value })
  }

  return (
    <ImageAdjustmentsView
      disabled={disabled}
      values={config}
      onValueChange={handleValueChange}
      onReset={resetAdjustments}
    />
  )
}
