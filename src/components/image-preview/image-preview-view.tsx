import styles from './image-preview.module.css'

export type ImagePreviewViewProps = {
  ref: React.RefObject<HTMLCanvasElement | null>
  image: ImageData | null
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
export function ImagePreviewView({ ref, image }: ImagePreviewViewProps) {
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
    <div className={styles.container}>
      <canvas
        ref={ref}
        width={320}
        height={200}
        style={{ width: '320px', height: '200px' }}
      />
    </div>
  )
}
