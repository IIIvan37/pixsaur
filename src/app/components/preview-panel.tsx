import { Trans } from '@lingui/react/macro'
import { Box, Flex, Heading } from '@radix-ui/themes'
import ImagePreview from '@/components/image-preview'

import styles from '@/styles/image-converter.module.css'
import { ColorPalette } from '@/components/color-palette'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setReducedPaletteAtom } from '../store/palette/palette'
import { reducedPaletteAtom } from '../store/preview/preview'
import ImageControls from '@/components/image-controls'

const PreviewPanel = () => {
  const reduced = useAtomValue(reducedPaletteAtom)
  const setReduced = useSetAtom(setReducedPaletteAtom)

  useEffect(() => {
    setReduced(reduced)
  }, [reduced, setReduced])

  return (
    <Box className={styles.panel}>
      <Box className={styles.flexColumn}>
        <Flex justify='between' align='center' mb='2'>
          <Heading size='2' className={styles.sectionTitle}>
            <Trans id='Aperçu'>Aperçu</Trans>
          </Heading>
        </Flex>
        <Box pt='2'>
          <ImagePreview />
        </Box>
        {/* Color Palette below preview */}
        <Box mt='2'>
          <ColorPalette />
        </Box>

        {/* Mode controls directly under palette */}
        <Box mt='2'>
          <ImageControls />
        </Box>
      </Box>
    </Box>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
