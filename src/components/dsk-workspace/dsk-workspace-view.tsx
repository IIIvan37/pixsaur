import { Trans } from '@lingui/react/macro'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import Button from '@/components/ui/button/button'
import Icon from '@/components/ui/icon'
import {
  calculateLinearSize,
  calculateScrSize,
  formatFileSize,
  formatImageSize,
  formatScrSize,
  generateDskFilenames,
  getModeLabel,
  isStandardMode
} from '@/export/exports/dsk-workspace-utils'
import styles from './dsk-workspace.module.css'

interface DskWorkspaceViewProps {
  readonly images: DskImage[]
  readonly hasImages: boolean
  readonly canAddCurrentImage: boolean
  readonly addButtonTitle: string
  readonly remainingSpace: string
  readonly onAddCurrentImage: () => void
  readonly onRemoveImage: (imageId: string) => void
  readonly onExport: () => void
  readonly getColorTitle: (index: number, color: string) => string
  readonly getRemoveImageTitle: () => string
}

export function DskWorkspaceView({
  images,
  hasImages,
  canAddCurrentImage,
  addButtonTitle,
  remainingSpace,
  onAddCurrentImage,
  onRemoveImage,
  onExport,
  getColorTitle,
  getRemoveImageTitle
}: Readonly<DskWorkspaceViewProps>) {
  return (
    <>
      <div className={styles.infoBox}>
        <Trans>
          Supports both CPC Classic and CPC Plus formats. The loader
          auto-detects the hardware type.
        </Trans>
      </div>
      <div className={styles.actions}>
        <Button
          onClick={onAddCurrentImage}
          disabled={!canAddCurrentImage}
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
                      {image.rasterChanges &&
                        image.rasterChanges.length > 0 && (
                          <span
                            className={styles.rasterBadge}
                            title={`${image.rasterChanges.length} raster change(s)`}
                          >
                            Rasters
                          </span>
                        )}
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
                        {image.paletteColors.map((color: string, i: number) => (
                          <div
                            key={`${image.id}-color-${i}`}
                            className={styles.paletteColor}
                            style={{ backgroundColor: color }}
                            title={getColorTitle(i, color)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => onRemoveImage(image.id)}
                    variant='icon'
                    className={styles.deleteButton}
                    title={getRemoveImageTitle()}
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
              <Trans>{remainingSpace} remaining</Trans>
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
    </>
  )
}
