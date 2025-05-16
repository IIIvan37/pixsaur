import { useEffect, useRef } from 'react'
import styles from '@/styles/image-preview.module.css'
import { previewImageAtom } from '@/app/store/preview/preview'
import { useAtomValue } from 'jotai'

const ImagePreview = () => {
  const ref = useRef<HTMLCanvasElement>(null)

  const image = useAtomValue(previewImageAtom)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !image) return

    canvas.width = 320
    canvas.height = 200

    const ctx = canvas.getContext('2d')!

    // Crée un canvas temporaire contenant l’image
    const temp = document.createElement('canvas')
    temp.width = image.width
    temp.height = image.height

    temp.getContext('2d')!.putImageData(image, 0, 0)

    // Étire vers 320x200
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(
      temp,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      320,
      image.height
    )
  }, [image])

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

ImagePreview.displayName = 'ImagePreview'

export default ImagePreview
