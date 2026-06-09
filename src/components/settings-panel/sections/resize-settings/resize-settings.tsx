/**
 * Resize settings component (smart component with hooks)
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  centerImageAtom,
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
  const strategy = useAtomValue(resampleStrategyAtom)
  const setStrategy = useSetAtom(setResampleStrategyAtom)

  // Applies to every pixel mode (all modes downscale in auto/cover, and mode 0
  // also in origin). Mode 1 origin is 1:1, where the choice is a no-op.
  const showStrategy = true

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
