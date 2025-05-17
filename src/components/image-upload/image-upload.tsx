import { memo, useCallback } from 'react'
import styles from '@/styles/image-upload.module.css'
import { useDropzone } from 'react-dropzone'
import { UploadIcon } from '@radix-ui/react-icons'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Handles loading an image file and processing it.
 *
 * @param {File} file - The image file to process.
 * @param {(img: HTMLImageElement) => void} onImageLoaded - Callback to handle the loaded image.
 */
const processImageFile = async (
  file: File,
  onImageLoaded: (img: HTMLImageElement) => void
) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url

  img.onload = async () => {
    if (file.type === 'image/svg+xml') {
      const container = document.createElement('div')
      container.innerHTML = await file.text()
      const svg = container.querySelector('svg')

      if (svg) {
        const viewBox = svg.getAttribute('viewBox')
        if (viewBox) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_x, _y, width, height] = viewBox.split(/\s+|,/)
          img.width = parseInt(width)
          img.height = parseInt(height)
        }
      }
    }
    onImageLoaded(img)
    URL.revokeObjectURL(url)
  }
}

export const ImageUpload = memo(({ onImageLoaded }: ImageUploadProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file && file.type.startsWith('image/')) {
        processImageFile(file, onImageLoaded)
      }
    },
    [onImageLoaded]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    multiple: false
  })

  return (
    <div
      {...getRootProps()}
      className={`${styles.dropzone} ${
        isDragActive ? styles.dropzoneActive : ''
      }`}
    >
      <input {...getInputProps()} id='image-upload' />
      <UploadIcon className={styles.icon} />
      <p className={styles.primaryText}>Glissez & déposez une image ici</p>
      <p className={styles.secondaryText}>
        ou cliquez pour sélectionner un fichier
      </p>
      <p className={styles.helpText}>Formats supportés: PNG, JPG, GIF, BMP</p>
    </div>
  )
})
