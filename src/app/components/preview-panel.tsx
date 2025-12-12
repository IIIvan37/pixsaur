import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { ColorPalette } from '@/components/color-palette/color-palette'
import { RasterBasePalette } from '@/components/color-palette/raster-base-palette'
import ImageControls from '@/components/image-controls/image-controls'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { ImagePreview } from '@/preview'

const PreviewPanel = () => {
  const rasterEnabled = useAtomValue(rasterEnabledAtom)

  return (
    <Panel>
      <Header title={<Trans>Aperçu</Trans>} />

      <ImagePreview />

      {/* Color Palette below preview - show raster palette in raster mode */}
      {rasterEnabled ? <RasterBasePalette /> : <ColorPalette />}

      {/* Mode controls directly under palette */}

      <ImageControls />
    </Panel>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
