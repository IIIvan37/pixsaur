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
 *
 * @component
 * @param {ImagePreviewViewProps} props - The props for the component.
 * @param {React.RefObject<HTMLCanvasElement | null>} props.ref - The ref for the canvas element.
 * @param {ImageData | null} props.image - The image data to be displayed.
 * @returns {JSX.Element} The rendered ImagePreviewView component.
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
    <div className={styles.container} ref={containerRefCallback}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: `{width}x`, height: `${height}px` }}
      />
    </div>
  )
}
