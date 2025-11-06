import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useId } from 'react'
import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import ImagePreview from '@/components/image-preview/image-preview'
import Flex from '@/components/ui/flex'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { Switch } from '@/components/ui/switch'
import { smoothingAtom } from '../store/config/config'
import { setReducedPaletteAtom } from '../store/palette/palette'
import { reducedPaletteRgbAtom } from '../store/preview/preview'

const PreviewPanel = () => {
  const smoothingId = useId()
  const reduced = useAtomValue(reducedPaletteRgbAtom)
  const setReduced = useSetAtom(setReducedPaletteAtom)
  const [smoothing, setSmoothing] = useAtom(smoothingAtom)
  useEffect(() => {
    setReduced(reduced)
  }, [reduced, setReduced])

  return (
    <Panel>
      <Flex align='baseline' justify='between' style={{ width: '100%' }}>
        <Header title={<Trans>Aperçu</Trans>} />
        <Switch
          checked={smoothing}
          onCheckedChange={(value) => {
            setSmoothing(value)
          }}
          id={smoothingId}
          label={<Trans>Lissage</Trans>}
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
