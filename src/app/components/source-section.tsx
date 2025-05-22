import { Box, Flex, Heading } from '@radix-ui/themes'
import { ImageUpload } from '@/components/image-upload/image-upload'
<<<<<<< Updated upstream

import { downscaleImage } from '@/libs/pixsaur-adapter/io/downscale-image'
=======
import Button from '@/components/ui/button'

>>>>>>> Stashed changes
import styles from '@/styles/image-converter.module.css'
import { ImageSelector } from '@/components/image-selector'
import Icon from '@/components/ui/icon'
import { canvasSizeAtom, imageAtom, setImgAtom } from '../store/image/image'
import { useAtomValue, useSetAtom } from 'jotai'
import { resetImageAdjustmentsAtom } from '../store/config/config'
import Button from '@/components/ui/button'

import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'

export default function SourceSection() {
  const containerRefCallback = useObservedCanvasWidth()
  const setImg = useSetAtom(setImgAtom)
  const canvasSize = useAtomValue(canvasSizeAtom)
  const img = useAtomValue(imageAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    setImg(img)
  }

  return (
    <Box className={styles.panel}>
      <Box className={styles.flexColumn} style={{ minWidth: '400px' }}>
        <Flex justify='between' align='center' mb='2'>
          <Heading size='1' className={styles.sectionTitle} mb='2'>
            Image Source
          </Heading>
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
        </Flex>
        {!img ? (
          <ImageUpload onImageLoaded={handleImageLoaded} />
        ) : (
          <Box className={styles.spaceY4}>
            <div className={styles.center} style={{ padding: '1rem' }}>
              <ImageSelector
                containerRefCallback={containerRefCallback}
                canvasWidth={canvasSize?.width || 0}
                canvasHeight={canvasSize?.height || 0}
              />
            </div>
          </Box>
        )}
      </Box>
    </Box>
  )
}
