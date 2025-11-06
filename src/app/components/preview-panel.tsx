import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useId } from 'react'
import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import ImagePreview from '@/components/image-preview/image-preview'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Flex from '@/components/ui/flex'
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
    <CollapsibleSection title={<Trans>Aperçu</Trans>} defaultOpen={true}>
      <Flex align='baseline' justify='between' style={{ width: '100%' }}>
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
    </CollapsibleSection>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
