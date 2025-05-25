// ✅ ImagePreviewView.tsx
import styles from './image-preview.module.css'

export type ImagePreviewViewProps = {
  containerRefCallback: (node: HTMLDivElement | null) => void
  ref: React.RefObject<HTMLCanvasElement | null>
  image: ImageData | null
  width: number
  height: number
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
  height
}: ImagePreviewViewProps) {
  if (!image) {
    return (
      <div className={styles.container}>
        <div className={`${styles.container} ${styles.emptyContainer}`}>
          <p className={styles.emptyText}>Aucune image traitée</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRefCallback}
      className={styles.container}
      style={{
        width: '100%',
        alignSelf: 'stretch',
        aspectRatio: '16 / 10', // 320x200 ratio
        maxHeight: '100%' // permet de s'étendre au besoin
      }}
    >
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block'
        }}
      />
    </div>
  )
}
