/**
 * Resize settings component (smart component with hooks)
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  centerImageAtom,
  pixelModeAtom,
  resampleStrategyAtom,
  resizeModeAtom,
  setResampleStrategyAtom,
  setResizeModeAtom
} from '@/app/store/config/config'
import { selectionAtom } from '@/app/store/image/image'
import { ResizeSettingsView } from './resize-settings-view'

export function ResizeSettings() {
  const resizeMode = useAtomValue(resizeModeAtom)
  const setResizeMode = useSetAtom(setResizeModeAtom)
  const selection = useAtomValue(selectionAtom)
  const [centerImage, setCenterImage] = useAtom(centerImageAtom)
  const pixelMode = useAtomValue(pixelModeAtom)
  const strategy = useAtomValue(resampleStrategyAtom)
  const setStrategy = useSetAtom(setResampleStrategyAtom)

  // The linear resampler runs for CPC mode 0 in every resize mode
  // (auto/cover/origin all downscale to the 2:1 mode-0 pixel grid).
  const showStrategy = pixelMode === 0

  return (
    <ResizeSettingsView
      resizeMode={resizeMode}
      onResizeModeChange={setResizeMode}
      selection={selection}
      centerImage={centerImage}
      onCenterImageChange={setCenterImage}
      showStrategy={showStrategy}
      strategy={strategy}
      onStrategyChange={setStrategy}
    />
  )
}
