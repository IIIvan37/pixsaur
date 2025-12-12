/**
 * Resize settings component (smart component with hooks)
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  centerImageAtom,
  resizeModeAtom,
  setResizeModeAtom
} from '@/app/store/config/config'
import { selectionAtom } from '@/app/store/image/image'
import { ResizeSettingsView } from './resize-settings-view'

export function ResizeSettings() {
  const resizeMode = useAtomValue(resizeModeAtom)
  const setResizeMode = useSetAtom(setResizeModeAtom)
  const selection = useAtomValue(selectionAtom)
  const [centerImage, setCenterImage] = useAtom(centerImageAtom)

  return (
    <ResizeSettingsView
      resizeMode={resizeMode}
      onResizeModeChange={setResizeMode}
      selection={selection}
      centerImage={centerImage}
      onCenterImageChange={setCenterImage}
    />
  )
}
