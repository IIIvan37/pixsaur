import { ImageUpload } from '@/components/image-upload/image-upload'

import styles from '@/styles/image-converter.module.css'
import { ImageSelector } from '@/components/image-selector'
import Icon from '@/components/ui/icon'
import { imageAtom, setImgAtom } from '../store/image/image'
import { useAtomValue, useSetAtom } from 'jotai'
import { resetImageAdjustmentsAtom } from '../store/config/config'
import Button from '@/components/ui/button'

export default function SourceSection() {
  const setImg = useSetAtom(setImgAtom)

  const img = useAtomValue(imageAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    setImg(img)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.flexColumn}>
        <div className={styles.sectionHeader}>
          <h1 className={styles.sectionTitle}>Image Source</h1>
          {!!img && (
            <Button
              variant='secondary'
              className={styles.changeButton}
              aria-label="Changer d'image"
              onClick={() => {
                resetAdjustments()
                setImg(null)
              }}
            >
              <Icon name='UploadIcon' className={styles.buttonIcon} />
              Changer d'image
            </Button>
          )}
        </div>
        <div className={styles.center} style={{ padding: '1rem' }}>
          {!img ? (
            <ImageUpload onImageLoaded={handleImageLoaded} />
          ) : (
            <ImageSelector />
          )}
        </div>
      </div>
    </div>
  )
}
