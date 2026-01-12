import { useAtomValue, useSetAtom } from 'jotai'
import {
  configAtom,
  resetImageAdjustmentsAtom,
  setComponentAtom
} from '@/app/store/config/config'
import type { AdjustementKey } from '@/app/store/config/types'
import { workingImageAtom } from '@/app/store/image/image'
import { logger } from '@/core'
import { AdjustementsView } from './adjustement.view'
import type { RangeOption } from './types'

export default function Adjustments() {
  const src = useAtomValue(workingImageAtom)
  const {
    red,
    green,
    blue,
    brightness,
    contrast,
    saturation,
    hue,
    vibrance,
    temperature,
    tint,
    gamma,
    exposure,
    highlights,
    shadows,
    posterization,
    sharpen,
    blur,
    edges
  } = useAtomValue(configAtom)

  const setComponent = useSetAtom(setComponentAtom)
  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  // Define the adjustments with their min, max, and step values

  const adjustments: RangeOption = {
    red: [red, 0, 2, 0.01],
    green: [green, 0, 2, 0.01],
    blue: [blue, 0, 2, 0.01],
    brightness: [brightness, 0, 2, 0.01],
    contrast: [contrast, 0, 2, 0.01],
    saturation: [saturation, 0, 2, 0.01],
    hue: [hue, -180, 180, 1],
    vibrance: [vibrance, -100, 100, 1],
    temperature: [temperature, -100, 100, 1],
    tint: [tint, -100, 100, 1],
    gamma: [gamma, 0.1, 3, 0.1],
    exposure: [exposure, -3, 3, 0.1],
    highlights: [highlights, -100, 100, 1],
    shadows: [shadows, -100, 100, 1],
    posterization: [posterization, 2, 256, 1],
    sharpen: [sharpen, 0, 2, 0.05],
    blur: [blur, 0, 3, 0.1],
    edges: [edges, 0, 1, 0.05]
  }

  const handleChange = ({
    key,
    value
  }: {
    key: AdjustementKey
    value: number
  }) => {
    setComponent({ key, value })
  }

  const handleReset = () => {
    if (!src?.data) {
      logger.warn('No source image available for reset')
      return
    }
    resetAdjustments()
  }

  return (
    <AdjustementsView
      disabled={!src?.data}
      adjustments={adjustments}
      onChange={handleChange}
      onReset={handleReset}
    />
  )
}
