import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  addImageToDskAtom,
  clearDskWorkspaceAtom,
  dskImagesAtom,
  hasDskImagesAtom,
  removeImageFromDskAtom
} from '@/app/store/dsk-workspace/dsk-workspace'
import Button from '@/components/ui/button/button'
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <Trans>DSK Workspace</Trans>
        </h3>
        {hasImages && (
          <Button
            onClick={clearWorkspace}
            variant='secondary'
            title={_(msg`Clear all images from workspace`)}
          >
            <Trans>Clear</Trans>
          </Button>
        )}
      </div>

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
          ➕ <Trans>Add Current Image</Trans>
        </Button>
      </div>

      {hasImages ? (
        <>
          <div className={styles.imageList}>
            {images.map((image) => (
              <div key={image.id} className={styles.imageItem}>
                <div className={styles.imageInfo}>
                  <div className={styles.imageName}>{image.name}</div>
                  <div className={styles.imageDetails}>
                    {getModeLabel(image.mode)} •{' '}
                    {formatSize(image.width, image.height)} •{' '}
                    {Math.round(image.scrData.length / 1024)} KB
                  </div>
                </div>
                <Button
                  onClick={() => removeImageFromDsk(image.id)}
                  variant='secondary'
                  title={_(msg`Remove image from workspace`)}
                >
                  🗑️
                </Button>
              </div>
            ))}
          </div>

          <div className={styles.exportSection}>
            <Button onClick={onExport} variant='primary'>
              💾 <Trans>Export DSK</Trans>
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
              No images in workspace yet. Add converted images to build your DSK
              file.
            </Trans>
          </p>
        </div>
      )}
    </div>
  )
}
