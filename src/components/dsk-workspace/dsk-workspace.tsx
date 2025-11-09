import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  addImageToDskAtom,
  dskImagesAtom,
  hasDskImagesAtom,
  removeImageFromDskAtom
} from '@/app/store/dsk-workspace/dsk-workspace'
import Button from '@/components/ui/button/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Icon from '@/components/ui/icon'
import styles from './dsk-workspace.module.css'
import {
  calculateDskRemainingSpace,
  calculateLinearSize,
  calculateScrSize,
  canAddImageToDsk,
  formatDskSpace,
  formatFileSize,
  formatImageSize,
  formatScrSize,
  generateDskFilenames,
  getModeLabel,
  isStandardMode
} from './dsk-workspace-utils'

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
    cpcHardware: 'classic' | 'plus'
    paletteFirmware: number[]
    palettePlus?: number[]
    thumbnailDataUrl?: string
    paletteColors?: string[]
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

  // Check if there is enough space on DSK for a new image
  const hasEnoughSpace = canAddImageToDsk(
    images,
    currentImageData
      ? {
          width: currentImageData.width,
          height: currentImageData.height,
          mode: currentImageData.mode,
          overscan: currentImageData.overscan
        }
      : undefined
  )
  const canAdd = canAddCurrentImage && hasEnoughSpace

  const handleAddCurrentImage = () => {
    if (currentImageData) {
      addImageToDsk(currentImageData)
    }
  }

  // Determine button title based on state
  let addButtonTitle: string
  if (canAddCurrentImage && hasEnoughSpace) {
    addButtonTitle = _(msg`Add current converted image to DSK workspace`)
  } else if (hasEnoughSpace) {
    addButtonTitle = _(msg`No image to add`)
  } else {
    addButtonTitle = _(msg`Not enough space on DSK`)
  }

  return (
    <CollapsibleSection title={<Trans>DSK Manager</Trans>} defaultOpen={false}>
      <div className={styles.infoBox}>
        <Trans>
          Supports both CPC Classic and CPC Plus formats. The loader
          auto-detects the hardware type.
        </Trans>
      </div>
      <div className={styles.actions}>
        <Button
          onClick={handleAddCurrentImage}
          disabled={!canAdd}
          title={addButtonTitle}
        >
          <Icon name='PlusIcon' /> <Trans>Add Current Image</Trans>
        </Button>
      </div>

      {hasImages ? (
        <>
          <div className={styles.imageList}>
            {images.map((image, index) => {
              // Generate the actual filename(s) that will be used on the DSK
              const dskFilenames = generateDskFilenames(
                index + 1,
                image.width,
                image.height,
                image.mode,
                image.overscan
              )

              // Calculate file size
              const isStandard = isStandardMode(
                image.width,
                image.height,
                image.mode,
                image.overscan
              )
              const fileSize = isStandard
                ? calculateScrSize()
                : calculateLinearSize(image.width, image.height, image.mode)

              return (
                <div key={image.id} className={styles.imageItem}>
                  {image.thumbnailDataUrl && (
                    <img
                      src={image.thumbnailDataUrl}
                      alt={dskFilenames[0]}
                      className={styles.thumbnail}
                    />
                  )}
                  <div className={styles.imageInfo}>
                    <div className={styles.imageName}>
                      {dskFilenames.length === 1 ? (
                        dskFilenames[0]
                      ) : (
                        <>
                          {dskFilenames[0].replace(/_1\.BIN$/, '.BIN')}
                          <span className={styles.chunkInfo}>
                            {' '}
                            ({dskFilenames.length} chunks)
                          </span>
                        </>
                      )}
                      <span
                        className={
                          image.cpcHardware === 'plus'
                            ? styles.hardwareBadgePlus
                            : styles.hardwareBadgeClassic
                        }
                        title={
                          image.cpcHardware === 'plus'
                            ? 'CPC Plus (4096 colors)'
                            : 'CPC Classic (27 colors)'
                        }
                      >
                        {image.cpcHardware === 'plus' ? 'Plus' : 'Classic'}
                      </span>
                    </div>
                    <div className={styles.imageDetails}>
                      {getModeLabel(image.mode)} •{' '}
                      {formatImageSize(image.width, image.height)} •{' '}
                      {isStandard
                        ? formatScrSize(fileSize)
                        : formatFileSize(fileSize)}
                      {!isStandard && (
                        <span className={styles.customBadge}> • Custom</span>
                      )}
                    </div>
                    {image.paletteColors && (
                      <div className={styles.palette}>
                        {image.paletteColors.map((color, i) => (
                          <div
                            key={`${image.id}-color-${i}`}
                            className={styles.paletteColor}
                            style={{ backgroundColor: color }}
                            title={_(msg`Color ${i}: ${color}`)}
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
                    <Icon name='TrashIcon' />
                  </Button>
                </div>
              )
            })}
          </div>

          <div className={styles.exportSection}>
            <Button onClick={onExport} variant='primary'>
              <Icon name='DownloadIcon' /> <Trans>Export DSK</Trans>
            </Button>
            <div className={styles.exportInfo}>
              <Trans>{images.length} image(s) ready to export</Trans>
              {' • '}
              <Trans>
                {formatDskSpace(calculateDskRemainingSpace(images))} remaining
              </Trans>
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
    </CollapsibleSection>
  )
}
