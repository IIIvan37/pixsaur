import { useAtomValue, useSetAtom } from 'jotai'
import {
  CUSTOM_DIMENSION_PRESETS,
  customDimensionsAtom,
  customDimensionsValidationAtom,
  modeAtom,
  setCustomDimensionsAtom
} from '@/app/store/config/config'
import { getBaseMode } from '@/app/store/config/types'
import { getHeightStep, getWidthStep } from '@/utils/validate-custom-dimensions'
import { CustomDimensionsView } from './custom-dimensions-view'

export const CustomDimensions = () => {
  const mode = useAtomValue(modeAtom)
  const dimensions = useAtomValue(customDimensionsAtom)
  const validation = useAtomValue(customDimensionsValidationAtom)
  const setDimensions = useSetAtom(setCustomDimensionsAtom)

  const baseMode = getBaseMode(mode)
  const widthStep = getWidthStep(baseMode)
  const heightStep = getHeightStep()

  // Get presets for current mode
  const presets =
    CUSTOM_DIMENSION_PRESETS[
      `mode${baseMode}` as keyof typeof CUSTOM_DIMENSION_PRESETS
    ]

  const handleWidthChange = (value: number) => {
    setDimensions({ width: value })
  }

  const handleHeightChange = (value: number) => {
    setDimensions({ height: value })
  }

  const handlePresetClick = (width: number, height: number) => {
    setDimensions({ width, height })
  }

  return (
    <CustomDimensionsView
      width={dimensions.width}
      height={dimensions.height}
      widthStep={widthStep}
      heightStep={heightStep}
      validation={validation}
      presets={presets}
      onWidthChange={handleWidthChange}
      onHeightChange={handleHeightChange}
      onPresetClick={handlePresetClick}
    />
  )
}
