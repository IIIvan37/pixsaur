import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Window } from '@tauri-apps/api/window'
import { useEffect, useId, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import Icon from '@/components/ui/icon'
import styles from './image-upload.module.css'

export type ImageUploadProps = {
  onUpload: (files: File[]) => void
  primaryText?: string
  secondaryText?: string
  helpText?: string
  isTauri?: boolean
}

// Constants
const IMAGE_EXTENSIONS = ['png', 'jpeg', 'jpg', 'gif', 'bmp', 'webp', 'svg']

/**
 * Detects the current environment characteristics
 */
const detectEnvironment = (isTauriProp: boolean) => {
  const isTauriEnv =
    typeof globalThis !== 'undefined' &&
    ('__TAURI__' in globalThis || isTauriProp)
  const userAgent = navigator.userAgent.toLowerCase()
  const isLinux =
    userAgent.includes('linux') ||
    userAgent.includes('wsl') ||
    (typeof process !== 'undefined' && process.platform === 'linux')
  const isWSL =
    userAgent.includes('wsl') ||
    (typeof process !== 'undefined' &&
      process.platform === 'linux' &&
      userAgent.includes('microsoft'))

  return { isTauriEnv, isLinux, isWSL }
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

  // Detect environment once at render
  const { isTauriEnv, isLinux, isWSL } = detectEnvironment(isTauri)

  // Helper function to process a dragged file
  const processFile = async (filePath: string, cb: (files: File[]) => void) => {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const buffer = await readFile(filePath)
      const fileName = filePath.split('/').pop() || 'image'
      const file = new File([buffer], fileName, {
        type: 'image/*'
      })
      cb([file])
    } catch (error) {
      // Log error for debugging but don't crash the app
      console.warn('[ImageUpload] Failed to process file:', filePath, error)
    }
  }

  // Helper function to handle drag-drop events
  const handleDragDropEvent = async (
    event: unknown,
    cb: (files: File[]) => void
  ) => {
    const dragEvent = event as { payload: { paths: string[] } }
    if (dragEvent?.payload?.paths?.length > 0) {
      const filePath = dragEvent.payload.paths[0]
      await processFile(filePath, cb)
    }
  }

  // Strategy pattern for upload
  const strategy = useRef<{
    init: (cb: (files: File[]) => void) => void | Promise<void>
    dropzoneProps: any
  }>({
    init: () => {},
    dropzoneProps: {}
  })

  if (isTauriEnv && (isLinux || isWSL)) {
    strategy.current = {
      init: async (cb: (files: File[]) => void) => {
        const win = await Window.getByLabel('main')
        if (win) {
          win.listen('tauri://drag-drop', async (event: unknown) => {
            await handleDragDropEvent(event, cb)
          })

          // Also try onDragDropEvent if available
          if (win.onDragDropEvent) {
            win.onDragDropEvent(async (event: unknown) => {
              await handleDragDropEvent(event, cb)
            })
          }
        } else {
          // Window not found
        }
      },
      dropzoneProps: {
        noClick: true,
        noKeyboard: true
      }
    }
  } else if (isTauriEnv) {
    strategy.current = {
      init: () => {},
      dropzoneProps: {
        noClick: true,
        noKeyboard: true
      }
    }
  }

  useEffect(() => {
    strategy.current.init(onUpload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUpload])

  const handleDrop = (files: File[]) => {
    // Only call onUpload if at least one file is selected
    if (files.length > 0) {
      onUpload(files)
    }
  }

  const handleClick = async (e: React.MouseEvent) => {
    // In Tauri mode, open native file dialog
    if (isTauri) {
      e.preventDefault()
      e.stopPropagation()
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: 'Images',
              extensions: IMAGE_EXTENSIONS
            }
          ]
        })
        if (selected && typeof selected === 'string') {
          await processFile(selected, onUpload)
        }
      } catch (error) {
        // Log error for debugging but don't crash the app
        console.warn('[ImageUpload] Failed to open file dialog:', error)
      }
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': []
    },
    multiple: false,
    ...strategy.current.dropzoneProps
  })

  const defaultPrimaryText = isTauri
    ? _(msg`Cliquez pour sélectionner une image`)
    : _(msg`Glissez & déposez une image ici`)
  const defaultSecondaryText = isTauri
    ? _(msg`Ou glissez-déposez un fichier (si supporté)`)
    : _(msg`ou cliquez pour sélectionner un fichier`)
  const defaultHelpText = _(
    msg`Formats supportés: PNG, JPEG, GIF, BMP, WEBP, SVG`
  )

  const rootProps = getRootProps()

  return (
    <button
      type='button'
      {...rootProps}
      className={`${styles.dropzone} ${
        isDragActive ? styles.dropzoneActive : ''
      }`}
      onClick={isTauri ? handleClick : rootProps.onClick}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (isTauri) {
            handleClick(e as unknown as React.MouseEvent)
          }
        }
      }}
      onDragEnter={(e) => {
        if (rootProps.onDragEnter) rootProps.onDragEnter(e)
      }}
      onDragOver={(e) => {
        if (rootProps.onDragOver) rootProps.onDragOver(e)
      }}
      onDragLeave={(e) => {
        if (rootProps.onDragLeave) rootProps.onDragLeave(e)
      }}
      onDrop={(e) => {
        if (rootProps.onDrop) rootProps.onDrop(e)
      }}
    >
      {!isTauri && (
        <input
          {...getInputProps()}
          id={uploadId}
          data-testid='image-upload-input'
        />
      )}
      <Icon name='UploadIcon' className={styles.icon} />
      <p className={styles.primaryText}>{primaryText || defaultPrimaryText}</p>
      <p className={styles.secondaryText}>
        {secondaryText || defaultSecondaryText}
      </p>
      <p className={styles.helpText}>{helpText || defaultHelpText}</p>
    </button>
  )
}
