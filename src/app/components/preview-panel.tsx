import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setReducedPaletteAtom } from '../store/palette/palette'

import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import ImagePreview from '@/components/image-preview/image-preview'

import { Panel } from '@/components/ui/layout/panel/panel'
import { Header } from '@/components/ui/layout/header/header'
import { reducedPaletteRgbAtom } from '../store/preview/preview'

const PreviewPanel = () => {
  const reduced = useAtomValue(reducedPaletteRgbAtom)
  const setReduced = useSetAtom(setReducedPaletteAtom)

  useEffect(() => {
    setReduced(reduced)
  }, [reduced, setReduced])

  return (
    <Panel>
      <Header title='Aperçu' />

      <ImagePreview />

      {/* Color Palette below preview */}

      <ColorPalette />

      {/* Mode controls directly under palette */}

      <ImageControls />
    </Panel>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
