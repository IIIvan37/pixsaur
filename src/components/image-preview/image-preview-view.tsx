// ImagePreviewView.tsx

import { Trans } from '@lingui/react/macro'
import type React from 'react'
import styles from './image-preview.module.css'

export type ImagePreviewViewProps = {
  readonly containerRefCallback: (node: HTMLDivElement | null) => void
  readonly ref: React.RefObject<HTMLCanvasElement | null>
  readonly image: ImageData | null
  readonly width: number
  readonly height: number
  readonly onClick?: () => void
  readonly tooltip?: string
}

/**
 * ImagePreviewView component renders a canvas element to display an image preview.
 * If no image is provided, it shows a message indicating that no image has been processed.
 */
export function ImagePreviewView({
  containerRefCallback,
  ref,
  image,
  width,
  height,
  onClick,
  tooltip
}: ImagePreviewViewProps) {
  if (!image) {
    return (
      <div className={`${styles.container} ${styles.emptyContainer}`}>
        <p className={styles.emptyText}>
          <Trans>Aucune image traitée</Trans>
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRefCallback} className={styles.container}>
      <div className={styles.canvasWrapper} data-tooltip={tooltip}>
        <canvas
          ref={ref}
          width={width}
          height={height}
          onClick={onClick}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            cursor: onClick ? 'pointer' : 'default'
          }}
        />
      </div>
    </div>
  )
}
