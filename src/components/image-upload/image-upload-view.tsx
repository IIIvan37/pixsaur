import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { UploadIcon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { useDropzone } from 'react-dropzone'
import styles from './image-upload.module.css'

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
  primaryText,
  secondaryText,
  helpText
}: ImageUploadProps) => {
  const { _ } = useLingui()
  const uploadId = useId()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onUpload,
    accept: {
      'image/*': []
    },
    multiple: false
  })

  const defaultPrimaryText = _(msg`Glissez & déposez une image ici`)
  const defaultSecondaryText = _(msg`ou cliquez pour sélectionner un fichier`)
  const defaultHelpText = _(
    msg`Formats supportés: PNG, JPEG, GIF, BMP, WEBP, SVG`
  )

  return (
    <div
      {...getRootProps()}
      className={`${styles.dropzone} ${
        isDragActive ? styles.dropzoneActive : ''
      }`}
    >
      <input
        {...getInputProps()}
        id={uploadId}
        data-testid='image-upload-input'
      />
      <UploadIcon className={styles.icon} />
      <p className={styles.primaryText}>{primaryText || defaultPrimaryText}</p>
      <p className={styles.secondaryText}>
        {secondaryText || defaultSecondaryText}
      </p>
      <p className={styles.helpText}>{helpText || defaultHelpText}</p>
    </div>
  )
}
