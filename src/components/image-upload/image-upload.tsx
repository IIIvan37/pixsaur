import { memo, useCallback } from 'react'
import { ImageUploadView } from './image-upload-view'
import { processImageFile } from './utils'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

export const ImageUpload = memo(({ onImageLoaded }: ImageUploadProps) => {
  const handleUpload = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file && file.type.startsWith('image/')) {
        processImageFile(file).then(onImageLoaded)
      }
    },
    [onImageLoaded]
  )

  return <ImageUploadView onUpload={handleUpload} />
})
