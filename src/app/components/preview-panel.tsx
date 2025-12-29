import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { modeREnabledAtom } from '@/app/store/config/config'
import { editorModeAtom, enterEditModeAtom } from '@/app/store/editor'
import { imageAtom } from '@/app/store/image/image'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { ColorPalette } from '@/components/color-palette/color-palette'
import { RasterBasePalette } from '@/components/color-palette/raster-base-palette'
import ImageControls from '@/components/image-controls/image-controls'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { ImagePreview } from '@/preview'

const PreviewPanel = () => {
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const modeREnabled = useAtomValue(modeREnabledAtom)
  const editorMode = useAtomValue(editorModeAtom)
  const enterEditMode = useSetAtom(enterEditModeAtom)
  const image = useAtomValue(imageAtom)

  const handleEditClick = () => {
    enterEditMode()
  }

  // Disable edit button when in editor mode, no image loaded, or Mode R is active
  // Mode R generates 2 images + 2 palettes which the current editor cannot handle
  const canEdit = !editorMode && image && !modeREnabled

  return (
    <Panel>
      <Header
        title={<Trans>Aperçu</Trans>}
        action={canEdit ? handleEditClick : undefined}
        actionLabel={<Trans>Éditer</Trans>}
        icon='Pencil2Icon'
      />

      <ImagePreview />

      {/* Color Palette below preview - show raster palette in raster mode, hide in editor mode */}
      {!editorMode &&
        (rasterEnabled ? <RasterBasePalette /> : <ColorPalette />)}

      {/* Mode controls directly under palette - hide in editor mode */}
      {!editorMode && <ImageControls />}
    </Panel>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
