import { AdjustementsView } from './adjustement.view'
import {
  configAtom,
  resetImageAdjustmentsAtom,
  setComponentAtom
} from '@/app/store/config/config'

import { RangeOption } from './types'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  downscaledAtom,
  setWorkingImageAtom,
  workingImageAtom
} from '@/app/store/image/image'
import { AdjustementKey } from '@/app/store/config/types'

export default function Adjustments() {
  const src = useAtomValue(workingImageAtom)
  const { red, green, blue, brightness, contrast, saturation } =
    useAtomValue(configAtom)
  const setComponent = useSetAtom(setComponentAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)

  const [downscaled] = useAtom(downscaledAtom)
  const setSrc = useSetAtom(setWorkingImageAtom)
  // Define the adjustments with their min, max, and step values
  const adjustments: RangeOption = {
    red: [red, 0, 2, 0.01],
    green: [green, 0, 2, 0.01],
    blue: [blue, 0, 2, 0.01],
    brightness: [brightness, 0, 2, 0.01],
    contrast: [contrast, 0, 3, 0.01],
    saturation: [saturation, 0, 3, 0.01]
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
    if (downscaled) {
      setSrc(null)
    } else {
      console.error('Downscaled image data is null.')
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
