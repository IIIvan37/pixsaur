import { Trans } from '@lingui/react/macro'
import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { ImagePreview } from '@/preview'

const PreviewPanel = () => {
  return (
    <Panel>
      <Header title={<Trans>Aperçu</Trans>} />

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
