import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { ImageSelector } from '@/components/image-selector'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { logger } from '@/core'
import { ImageUpload, processImageFile } from '@/source'
import { isTauri, pickImageFileTauriAsFile } from '@/tauri'
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
  const [isDragOver, setIsDragOver] = useState(false)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const setOpenImagePicker = useSetAtom(setOpenImagePickerAtom)
  const handleImageLoaded = useCallback(
    (img: HTMLImageElement) => {
      resetAdjustments()
      setSelection(null)
      setImg(img)
    },
    [resetAdjustments, setSelection, setImg]
  )

  // Handle native drop event - doesn't interfere with ImageSelector's selection drag
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (!file?.type.startsWith('image/')) return

      processImageFile(file)
        .then(handleImageLoaded)
        .catch((err) =>
          logger.error('[SourceSection] Failed to load dropped image:', err)
        )
    },
    [handleImageLoaded]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only show drag feedback when dragging files (not internal drag like selection)
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

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
        // biome-ignore lint/a11y/noStaticElementInteractions: Drop zone wrapper for replacing image
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            position: 'relative',
            width: '100%',
            outline: isDragOver ? '2px dashed var(--color-primary)' : 'none',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <ImageSelector />
        </div>
      ) : (
        <ImageUpload onImageLoaded={handleImageLoaded} />
      )}
    </Panel>
  )
}
