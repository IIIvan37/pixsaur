import { useSetAtom } from 'jotai'
import { memo, useCallback } from 'react'
import { pushToastAtom } from '@/app/store/notifications/toast'
import { logger } from '@/core'
import { isTauri } from '@/tauri'
import { ImageUploadView } from './image-upload-view'
import { pickImageFileTauriAsFile } from './tauri-file-picker'
import { processImageFile } from './utils'
import {
  validateFileSize,
  validateImageDimensions
} from './validate-image-file'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Check if running in Tauri environment
 * In Tauri v2, we check if the module can be imported
 */

export const ImageUpload = memo(
  ({ onImageLoaded }: Readonly<ImageUploadProps>) => {
    const pushToast = useSetAtom(pushToastAtom)

    // Decode a validated file and surface a toast if it exceeds the limits.
    const loadValidatedFile = useCallback(
      async (file: File) => {
        const sizeCheck = validateFileSize(file)
        if (!sizeCheck.ok) {
          pushToast('image-too-large')
          return
        }

        const img = await processImageFile(file)

        const dimensionCheck = validateImageDimensions(img)
        if (!dimensionCheck.ok) {
          pushToast('image-dimensions-too-large')
          return
        }

        onImageLoaded(img)
      },
      [onImageLoaded, pushToast]
    )

    const handleUpload = useCallback(
      async (acceptedFiles: File[]) => {
        try {
          // In Tauri with empty array, use native dialog
          if (isTauri() && acceptedFiles.length === 0) {
            const file = await pickImageFileTauriAsFile()
            if (!file) return
            await loadValidatedFile(file)
            return
          }

          // Handle dropped/selected file
          const file = acceptedFiles[0]
          if (!file?.type.startsWith('image/')) return

          // In Tauri, drag & drop is disabled - only native dialog works
          // In web mode, use standard FileReader
          await loadValidatedFile(file)
        } catch (error) {
          logger.error('[ImageUpload] Failed to load image:', error)
        }
      },
      [loadValidatedFile]
    )

    return <ImageUploadView onUpload={handleUpload} isTauri={isTauri()} />
  }
)
