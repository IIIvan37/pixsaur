import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { ImageResizePanel } from '@/components/image-resize/image-resize-panel'
import { ImageSelector } from '@/components/image-selector'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import {
  ImageUpload,
  pickImageFileTauriAsFile,
  processImageFile
} from '@/source'
import { isTauri } from '@/utils/is-tauri'
import logger from '@/utils/logger'
import { resetImageAdjustmentsAtom } from '../store/config/config'
import {
  imageAtom,
  setImgAtom,
  setOpenImagePickerAtom,
  setSelectionAtom
} from '../store/image/image'

export default function SourceSection() {
  const setImg = useSetAtom(setImgAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const img = useAtomValue(imageAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const setOpenImagePicker = useSetAtom(setOpenImagePickerAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    setImg(img)
  }

  return (
    <Panel>
      <Header
        title={<Trans>Image source</Trans>}
        actionLabel={<Trans>Changer d'image</Trans>}
        action={async () => {
          resetAdjustments()
          // Clear the current image & selection (previous behavior) and
          // then open the uploader so the user can pick a new image.
          setImg(null)
          setSelection(null)
          // On Tauri we open the native dialog ourselves because the
          // `ImageUpload` component may not be mounted when an image is
          // present (so the `openImagePickerAtom` wouldn't be observed).
          if (isTauri()) {
            try {
              const file = await pickImageFileTauriAsFile()
              if (!file) return
              const loaded = await processImageFile(file)
              setImg(loaded)
            } catch (err) {
              logger.warn(
                '[SourceSection] Failed to pick image with Tauri',
                err
              )
              // fallback to the web uploader in case of failure
              // fallback to the web uploader in case of failure. Use a small
              // delay to avoid re-entrancy bugs with native dialogs that can
              // cause the picker to reopen immediately on cancel.
              setTimeout(() => setOpenImagePicker(true), 0)
            }
            return
          }

          // Schedule open on the next tick to avoid re-opening the file
          // dialog on browsers when users cancel the native dialog.
          // This prevents event bubbling / focus timing issues that cause
          // the picker to reopen immediately after cancel.
          setTimeout(() => setOpenImagePicker(true), 0)
        }}
        icon='UploadIcon'
      />

      {img ? (
        <>
          <ImageSelector />
          {/* Resize mode controls - placed after source selection */}
          <ImageResizePanel />
        </>
      ) : (
        <ImageUpload onImageLoaded={handleImageLoaded} />
      )}
    </Panel>
  )
}
