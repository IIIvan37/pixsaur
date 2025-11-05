import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { DownloadIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import {
  addImageToDskAtom,
  clearDskWorkspaceAtom,
  dskImagesAtom,
  hasDskImagesAtom,
  removeImageFromDskAtom
} from '@/app/store/dsk-workspace/dsk-workspace'
import Button from '@/components/ui/button/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import styles from './dsk-workspace.module.css'

interface DskWorkspaceProps {
  onExport: () => void
  currentImageData?: {
    name: string
    scrData: Uint8Array
    mode: 0 | 1 | 2
    width: number
    height: number
    overscan: boolean
    nColors: number
    scaleX: number
    scaleY: number
    paletteFirmware: number[]
  }
  canAddCurrentImage: boolean
}

export default function DskWorkspace({
  onExport,
  currentImageData,
  canAddCurrentImage
}: Readonly<DskWorkspaceProps>) {
  const { _ } = useLingui()
  const images = useAtomValue(dskImagesAtom)
  const hasImages = useAtomValue(hasDskImagesAtom)
  const addImageToDsk = useSetAtom(addImageToDskAtom)
  const removeImageFromDsk = useSetAtom(removeImageFromDskAtom)
  const clearWorkspace = useSetAtom(clearDskWorkspaceAtom)

  const [isExpanded, setIsExpanded] = useState(true)

  const handleAddCurrentImage = () => {
    if (currentImageData) {
      addImageToDsk(currentImageData)
    }
  }

  const formatSize = (width: number, height: number) => `${width}×${height}`

  const getModeLabel = (mode: number) => {
    switch (mode) {
      case 0:
        return 'Mode 0'
      case 1:
        return 'Mode 1'
      case 2:
        return 'Mode 2'
      default:
        return `Mode ${mode}`
    }
  }

  return (
    <Panel>
      <Header
        title={<Trans>DSK Workspace {hasImages && `(${images.length})`}</Trans>}
        action={hasImages ? clearWorkspace : undefined}
        actionLabel={hasImages ? <Trans>Clear</Trans> : undefined}
      />

      <div className={styles.section}>
        <button
          type='button'
          className={styles.sectionHeader}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className={styles.sectionTitle}>
            <Trans>Images</Trans>
          </span>
          <span className={styles.sectionToggle}>{isExpanded ? '▼' : '▶'}</span>
        </button>

        {isExpanded && (
          <div className={styles.sectionContent}>
            <div className={styles.actions}>
              <Button
                onClick={handleAddCurrentImage}
                disabled={!canAddCurrentImage}
                title={
                  canAddCurrentImage
                    ? _(msg`Add current converted image to DSK workspace`)
                    : _(msg`No image to add`)
                }
              >
                <PlusIcon /> <Trans>Add Current Image</Trans>
              </Button>
            </div>

            {hasImages ? (
              <>
                <div className={styles.imageList}>
                  {images.map((image) => (
                    <div key={image.id} className={styles.imageItem}>
                      {image.thumbnailDataUrl && (
                        <img
                          src={image.thumbnailDataUrl}
                          alt={image.name}
                          className={styles.thumbnail}
                        />
                      )}
                      <div className={styles.imageInfo}>
                        <div className={styles.imageName}>{image.name}</div>
                        <div className={styles.imageDetails}>
                          {getModeLabel(image.mode)} •{' '}
                          {formatSize(image.width, image.height)} •{' '}
                          {Math.round(image.scrData.length / 1024)} KB
                        </div>
                        {image.paletteColors && (
                          <div className={styles.palette}>
                            {image.paletteColors.map((color, i) => (
                              <div
                                key={`${image.id}-color-${i}`}
                                className={styles.paletteColor}
                                style={{ backgroundColor: color }}
                                title={`Color ${i}: ${color}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => removeImageFromDsk(image.id)}
                        variant='icon'
                        className={styles.deleteButton}
                        title={_(msg`Remove image from workspace`)}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className={styles.exportSection}>
                  <Button onClick={onExport} variant='primary'>
                    <DownloadIcon /> <Trans>Export DSK</Trans>
                  </Button>
                  <div className={styles.exportInfo}>
                    <Trans>{images.length} image(s) ready to export</Trans>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <p>
                  <Trans>
                    No images in workspace yet. Add converted images to build
                    your DSK file.
                  </Trans>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
