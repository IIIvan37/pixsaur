import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setReducedPaletteAtom } from '../store/palette/palette'

import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import ImagePreview from '@/components/image-preview/image-preview'

import { Panel } from '@/components/ui/layout/panel/panel'
import { Header } from '@/components/ui/layout/header/header'
import { reducedPaletteRgbAtom } from '../store/preview/preview'
import Flex from '@/components/ui/flex'
import { Switch } from '@/components/ui/switch'
import { smoothingAtom } from '../store/config/config'

const PreviewPanel = () => {
  const reduced = useAtomValue(reducedPaletteRgbAtom)
  const setReduced = useSetAtom(setReducedPaletteAtom)
  const [smoothing, setSmoothing] = useAtom(smoothingAtom)
  useEffect(() => {
    setReduced(reduced)
  }, [reduced, setReduced])

  return (
    <Panel>
      <Flex align='baseline' justify='between' style={{ width: '100%' }}>
        <Header title='Aperçu' />
        <Switch
          checked={smoothing}
          onCheckedChange={(value) => {
            setSmoothing(value)
          }}
          id='smoothing-panel-id'
          label='Lissage'
        />
      </Flex>

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
