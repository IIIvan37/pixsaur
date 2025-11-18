import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input/input'
import type { DskAdditionalFile } from '@/export'
import styles from './dsk-files-manager.module.css'

type Props = {
  files: DskAdditionalFile[]
  onChange: (files: DskAdditionalFile[]) => void
  disabled?: boolean
}

export default function DskFilesManager({
  files,
  onChange,
  disabled = false
}: Readonly<Props>) {
  const { _ } = useLingui()
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    setUploadError(null)

    try {
      const newFiles: DskAdditionalFile[] = []

      for (const file of Array.from(uploadedFiles)) {
        // Check file size (max 64KB for CPC)
        if (file.size > 65536) {
          setUploadError(
            _(msg`File ${file.name} is too large (max 64KB). File skipped.`)
          )
          continue
        }

        // Read file content
        const arrayBuffer = await file.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)

        // Generate CPC-compatible filename (8.3 format)
        const cpcFilename = generateCpcFilename(file.name)

        newFiles.push({
          name: cpcFilename,
          data,
          loadAddress: 0x4000, // Default load address
          execAddress: undefined
        })
      }

      if (newFiles.length > 0) {
        onChange([...files, ...newFiles])
      }
    } catch (error) {
      setUploadError(
        _(
          msg`Error reading file: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      )
    }

    // Reset input
    event.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const handleUpdateFile = (
    index: number,
    updates: Partial<DskAdditionalFile>
  ) => {
    const updatedFiles = [...files]
    updatedFiles[index] = { ...updatedFiles[index], ...updates }
    onChange(updatedFiles)
  }

  const handleAddManualFile = () => {
    onChange([
      ...files,
      {
        name: 'FILE.BIN',
        data: new Uint8Array([]),
        loadAddress: 0x4000
      }
    ])
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <Trans>Additional DSK Files</Trans>
        </h3>
        <div className={styles.actions}>
          <label className={styles.uploadButton}>
            <span>📤</span>
            <Trans>Upload Files</Trans>
            <input
              type='file'
              multiple
              accept='.bin,.bas,.dat'
              onChange={handleFileUpload}
              disabled={disabled}
              style={{ display: 'none' }}
            />
          </label>
          <Button
            onClick={handleAddManualFile}
            disabled={disabled}
            variant='secondary'
          >
            <span>➕</span>
            <Trans>Add Empty</Trans>
          </Button>
        </div>
      </div>

      {uploadError && <div className={styles.error}>{uploadError}</div>}

      {files.length === 0 ? (
        <div className={styles.empty}>
          <Trans>
            No additional files. Upload or add files to include them in the DSK.
          </Trans>
        </div>
      ) : (
        <div className={styles.fileList}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className={styles.fileItem}>
              <div className={styles.fileInfo}>
                <Input
                  type='text'
                  value={file.name}
                  onChange={(e) =>
                    handleUpdateFile(index, {
                      name: e.target.value.toUpperCase()
                    })
                  }
                  disabled={disabled}
                  placeholder='FILENAME.EXT'
                  className={styles.filenameInput}
                  maxLength={12}
                />
                <span className={styles.fileSize}>
                  {formatSize(file.data.length)}
                </span>
              </div>

              <div className={styles.addresses}>
                <div className={styles.addressGroup}>
                  <span className={styles.addressLabel}>
                    <Trans>Load</Trans>
                  </span>
                  <Input
                    type='text'
                    value={
                      file.loadAddress === undefined
                        ? ''
                        : `0x${file.loadAddress.toString(16).toUpperCase()}`
                    }
                    onChange={(e) => {
                      const value = sanitizeHexInput(e.target.value)
                      const address = value
                        ? Number.parseInt(value, 16)
                        : undefined
                      handleUpdateFile(index, { loadAddress: address })
                    }}
                    disabled={disabled}
                    placeholder='0x4000'
                    className={styles.addressInput}
                  />
                </div>

                <div className={styles.addressGroup}>
                  <span className={styles.addressLabel}>
                    <Trans>Exec</Trans>
                  </span>
                  <Input
                    type='text'
                    value={
                      file.execAddress === undefined
                        ? ''
                        : `0x${file.execAddress.toString(16).toUpperCase()}`
                    }
                    onChange={(e) => {
                      const value = sanitizeHexInput(e.target.value)
                      const address = value
                        ? Number.parseInt(value, 16)
                        : undefined
                      handleUpdateFile(index, { execAddress: address })
                    }}
                    disabled={disabled}
                    placeholder='Optional'
                    className={styles.addressInput}
                  />
                </div>

                <Button
                  onClick={() => handleRemoveFile(index)}
                  disabled={disabled}
                  className={styles.removeButton}
                  title={_(msg`Remove file`)}
                >
                  <span>🗑️</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Sanitize hex input by keeping only hex characters
 */
function sanitizeHexInput(input: string): string {
  return input
    .split('')
    .filter((char) => /[0-9a-fA-Fx]/.test(char))
    .join('')
}

/**
 * Generate CPC-compatible filename (8.3 format)
 */
function generateCpcFilename(filename: string): string {
  // Remove path if present
  const basename = filename.split('/').pop() || filename

  // Split name and extension
  const lastDot = basename.lastIndexOf('.')
  let name = lastDot > 0 ? basename.slice(0, lastDot) : basename
  let ext = lastDot > 0 ? basename.slice(lastDot + 1) : ''

  // Clean and limit name (8 chars max)
  name = name
    .toUpperCase()
    .split('')
    .filter((char) => /[A-Z0-9]/.test(char))
    .join('')
    .padEnd(1, '_')
    .slice(0, 8)

  // Clean and limit extension (3 chars max)
  ext = ext
    .toUpperCase()
    .split('')
    .filter((char) => /[A-Z0-9]/.test(char))
    .join('')
    .slice(0, 3)

  return ext ? `${name}.${ext}` : name
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
