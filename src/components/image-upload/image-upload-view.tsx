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
  isTauri?: boolean
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
 * @param {boolean} [props.isTauri] - Whether running in Tauri (disables file input).
 * @returns {JSX.Element} The rendered component.
 */
export const ImageUploadView = ({
  onUpload,
  primaryText,
  secondaryText,
  helpText,
  isTauri = false
}: ImageUploadProps) => {
  const { _ } = useLingui()
  const uploadId = useId()

  const handleDrop = (files: File[]) => {
    // Only call onUpload if at least one file is selected
    if (files.length > 0) {
      onUpload(files)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // In Tauri mode, prevent default and trigger native dialog
    if (isTauri) {
      e.preventDefault()
      e.stopPropagation()
      onUpload([]) // Empty array triggers native dialog in Tauri
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': []
    },
    multiple: false,
    noClick: isTauri, // Disable default click behavior in Tauri
    noKeyboard: isTauri,
    noDrag: isTauri // Disable drag in Tauri - use native dialog only
  })

  const defaultPrimaryText = _(msg`Glissez & déposez une image ici`)
  const defaultSecondaryText = _(msg`ou cliquez pour sélectionner un fichier`)
  const defaultHelpText = _(
    msg`Formats supportés: PNG, JPEG, GIF, BMP, WEBP, SVG`
  )

  const rootProps = getRootProps()

  return (
    <button
      {...rootProps}
      className={`${styles.dropzone} ${
        isDragActive ? styles.dropzoneActive : ''
      }`}
      onClick={isTauri ? handleClick : rootProps.onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (isTauri) {
            handleClick(e as any)
          }
        }
      }}
      type="button"
    >
      {!isTauri && (
        <input
          {...getInputProps()}
          id={uploadId}
          data-testid='image-upload-input'
        />
      )}
      <UploadIcon className={styles.icon} />
      <p className={styles.primaryText}>{primaryText || defaultPrimaryText}</p>
      <p className={styles.secondaryText}>
        {secondaryText || defaultSecondaryText}
      </p>
      <p className={styles.helpText}>{helpText || defaultHelpText}</p>
    </button>
  )
}
