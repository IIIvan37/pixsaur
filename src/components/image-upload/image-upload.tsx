import { memo, useCallback } from 'react'
import { ImageUploadView } from './image-upload-view'
import { processImageFile } from './utils'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Check if running in Tauri environment
 * In Tauri v2, we check if the module can be imported
 */
function isTauri(): boolean {
  // Check if we're in a Tauri context by trying to access window.__TAURI_INTERNALS__
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}

export const ImageUpload = memo(
  ({ onImageLoaded }: Readonly<ImageUploadProps>) => {
    const handleUpload = useCallback(
      async (acceptedFiles: File[]) => {
        // In Tauri with empty array, use native dialog
        if (isTauri() && acceptedFiles.length === 0) {
          try {
            const { pickImageFileTauri } = await import('./tauri-file-picker')
            const dataUrl = await pickImageFileTauri()

            if (dataUrl) {
              const img = new Image()
              img.onload = () => onImageLoaded(img)
              img.onerror = (e) =>
                console.error('[ImageUpload] Image load failed:', e)
              img.src = dataUrl
            }
          } catch (error) {
            console.error('[ImageUpload] Failed to load image:', error)
          }
          return
        }

        // Handle dropped/selected file
        const file = acceptedFiles[0]
        if (!file?.type.startsWith('image/')) return

        // In Tauri, drag & drop is disabled - only native dialog works
        // In web mode, use standard FileReader
        processImageFile(file).then(onImageLoaded).catch(console.error)
      },
      [onImageLoaded]
    )

    return <ImageUploadView onUpload={handleUpload} isTauri={isTauri()} />
  }
)
