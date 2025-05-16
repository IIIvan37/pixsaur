import { Trans } from '@lingui/react/macro'
import { Box, Flex, Heading } from '@radix-ui/themes'
import { ImageUpload } from '@/components/image-upload'
import Button from '@/components/ui/button'
import { downscaleImage } from '@/libs/pixsaur-adapter/io/downscale-image'
import styles from '@/styles/image-converter.module.css'
import { ImageSelector } from '@/components/image-selector'
import Icon from '@/components/ui/icon'
import { downscaledAtom, setDownscaledAtom } from '../store/image/image'
import { useAtomValue, useSetAtom } from 'jotai'
import { resetImageAdjustmentsAtom } from '../store/config/config'

type SourceSectionProps = {
  canvasWidth: number
  canvasHeight: number
}

export default function SourceSection({
  canvasWidth,
  canvasHeight
}: SourceSectionProps) {
  const downscaled = useAtomValue(downscaledAtom)
  const setDownscaled = useSetAtom(setDownscaledAtom)
  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    const downscaled = downscaleImage(img, canvasWidth, undefined)
    setDownscaled(downscaled)
  }

  return (
    <Box className={styles.panel}>
      <Box className={styles.flexColumn} style={{ minWidth: '400px' }}>
        <Flex justify='between' align='center' mb='2'>
          <Heading size='1' className={styles.sectionTitle} mb='2'>
            <Trans id='Image Source'>Image Source</Trans>
          </Heading>
          {!!downscaled && (
            <Button
              variant='secondary'
              className={styles.changeButton}
              aria-label="Changer d'image"
              onClick={() => {
                resetAdjustments()
                setDownscaled(null)
              }}
            >
              <Icon name='UploadIcon' className={styles.buttonIcon} />
              <Trans id="Changer d'image">Changer d'image</Trans>
            </Button>
          )}
        </Flex>
        {!downscaled ? (
          <ImageUpload onImageLoaded={handleImageLoaded} />
        ) : (
          <Box className={styles.spaceY4}>
            <div className={styles.center}>
              <ImageSelector
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            </div>
          </Box>
        )}
      </Box>
    </Box>
  )
}
