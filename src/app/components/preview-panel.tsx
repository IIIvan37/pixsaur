import { Box, Flex, Heading } from '@radix-ui/themes'
import ImagePreview from '@/components/image-preview'

import styles from '@/styles/image-converter.module.css'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setReducedPaletteAtom } from '../store/palette/palette'
import { reducedPaletteAtom } from '../store/preview/preview'

import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'

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
            Aperçu
          </Heading>
        </Flex>
        <Box
          pt='2'
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
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
