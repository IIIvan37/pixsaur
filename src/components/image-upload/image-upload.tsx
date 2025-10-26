import { memo, useCallback } from 'react'
import { ImageUploadView } from './image-upload-view'
import { processImageFile } from './utils'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI__' in globalThis
}

export const ImageUpload = memo(({ onImageLoaded }: ImageUploadProps) => {
  const handleUpload = useCallback(
    async (acceptedFiles: File[]) => {
      // In Tauri, use native dialog instead of drag-and-drop
      if (isTauri()) {
        try {
          const { pickImageFileTauri } = await import('./tauri-file-picker')
          const dataUrl = await pickImageFileTauri()
          
          if (dataUrl) {
            const img = new Image()
            img.onload = () => onImageLoaded(img)
            img.src = dataUrl
          }
        } catch (error) {
          console.error('Failed to load image:', error)
        }
        return
      }

      // Web browser: use standard file input
      const file = acceptedFiles[0]
      if (file?.type.startsWith('image/')) {
        processImageFile(file).then(onImageLoaded)
      }
    },
    [onImageLoaded]
  )

  return <ImageUploadView onUpload={handleUpload} />
})
