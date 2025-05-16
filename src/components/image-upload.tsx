import { memo, useCallback } from 'react'
import styles from '@/styles/image-upload.module.css'
import { useDropzone } from 'react-dropzone'
import { UploadIcon } from '@radix-ui/react-icons'

export type ImageUploadProps = {
  onImageLoaded: (img: HTMLImageElement) => void
}
export const ImageUpload = memo(({ onImageLoaded }: ImageUploadProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.src = url
        img.onload = () => {
          onImageLoaded(img)
          URL.revokeObjectURL(url)
        }
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
