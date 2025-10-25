import { useAtomValue, useSetAtom } from 'jotai'
import {
  modeAtom,
  setTargetDimensionsAtom,
  TARGET_DIMENSION_PRESETS,
  targetDimensionsAtom,
  targetDimensionsValidationAtom
} from '@/app/store/config/config'
import { getHeightStep, getWidthStep } from '@/utils/validate-custom-dimensions'
import { TargetDimensionsView } from './target-dimensions-view'

export const TargetDimensions = () => {
  const mode = useAtomValue(modeAtom)
  const dimensions = useAtomValue(targetDimensionsAtom)
  const validation = useAtomValue(targetDimensionsValidationAtom)
  const setDimensions = useSetAtom(setTargetDimensionsAtom)

  // Mode is now just '0', '1', or '2'
  const baseMode = Number(mode) as 0 | 1 | 2
  const widthStep = getWidthStep(baseMode)
  const heightStep = getHeightStep()

  // Get presets for current mode
  const presets =
    TARGET_DIMENSION_PRESETS[
      `mode${baseMode}` as keyof typeof TARGET_DIMENSION_PRESETS
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
    <TargetDimensionsView
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
