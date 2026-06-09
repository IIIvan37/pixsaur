/**
 * Resize settings component (smart component with hooks)
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  centerImageAtom,
  mode0FilterAtom,
  pixelModeAtom,
  resizeModeAtom,
  setMode0FilterAtom,
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
  const mode0Filter = useAtomValue(mode0FilterAtom)
  const setMode0Filter = useSetAtom(setMode0FilterAtom)

  // The linear resampler runs for CPC mode 0 in every resize mode
  // (auto/cover/origin all downscale to the 2:1 mode-0 pixel grid).
  const showMode0Filter = pixelMode === 0

  return (
    <ResizeSettingsView
      resizeMode={resizeMode}
      onResizeModeChange={setResizeMode}
      selection={selection}
      centerImage={centerImage}
      onCenterImageChange={setCenterImage}
      showMode0Filter={showMode0Filter}
      mode0Filter={mode0Filter}
      onMode0FilterChange={setMode0Filter}
    />
  )
}
