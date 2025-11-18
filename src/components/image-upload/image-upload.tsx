import { memo, useCallback } from 'react'
import { logger } from '@/core'
import { isTauri } from '@/tauri'
import { ImageUploadView } from './image-upload-view'
import { pickImageFileTauriAsFile } from './tauri-file-picker'
import { processImageFile } from './utils'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Check if running in Tauri environment
 * In Tauri v2, we check if the module can be imported
 */

export const ImageUpload = memo(
  ({ onImageLoaded }: Readonly<ImageUploadProps>) => {
    const handleUpload = useCallback(
      async (acceptedFiles: File[]) => {
        // In Tauri with empty array, use native dialog
        if (isTauri() && acceptedFiles.length === 0) {
          try {
            const file = await pickImageFileTauriAsFile()
            if (!file) return
            const img = await processImageFile(file)
            onImageLoaded(img)
          } catch (error) {
            logger.error('[ImageUpload] Failed to load image:', error)
          }
          return
        }

        // Handle dropped/selected file
        const file = acceptedFiles[0]
        if (!file?.type.startsWith('image/')) return

        // In Tauri, drag & drop is disabled - only native dialog works
        // In web mode, use standard FileReader
        processImageFile(file)
          .then(onImageLoaded)
          .catch((e) => logger.error(e))
      },
      [onImageLoaded]
    )

    return <ImageUploadView onUpload={handleUpload} isTauri={isTauri()} />
  }
)
