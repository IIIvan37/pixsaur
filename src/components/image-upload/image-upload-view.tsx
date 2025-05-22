import styles from './image-upload.module.css'
import { useDropzone } from 'react-dropzone'
import { UploadIcon } from '@radix-ui/react-icons'

export type ImageUploadProps = {
  onUpload: (files: File[]) => void
  primaryText?: string
  secondaryText?: string
  helpText?: string
}

/**
 * ImageUploadView provides a drag-and-drop area for uploading image files.
 *
 * @component
 * @param {ImageUploadProps} props - The props for the component.
 * @param {(files: File[]) => void} props.onUpload - Callback invoked with the uploaded files.
 * @param {string} [props.primaryText] - Main instructional text.
 * @param {string} [props.secondaryText] - Secondary instructional text.
 * @param {string} [props.helpText] - Helper text for supported formats.
 * @returns {JSX.Element} The rendered component.
 */
export const ImageUploadView = ({
  onUpload,
  primaryText = 'Glissez & déposez une image ici',
  secondaryText = 'ou cliquez pour sélectionner un fichier',
  helpText = 'Formats supportés: PNG, JPEG, GIF, BMP, WEBP, SVG'
}: ImageUploadProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onUpload,
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
      <input
        {...getInputProps()}
        id='image-upload'
        data-testid='image-upload-input'
      />
      <UploadIcon className={styles.icon} />
      <p className={styles.primaryText}>{primaryText}</p>
      <p className={styles.secondaryText}>{secondaryText}</p>
      <p className={styles.helpText}>{helpText}</p>
    </div>
  )
}
