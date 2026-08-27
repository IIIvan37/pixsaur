import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { editorModeAtom, enterEditModeAtom } from '@/app/store/editor'
import { imageAtom } from '@/app/store/image/image'
import {
  activeRenderingPathAtom,
  activeRenderingPathCapabilitiesAtom
} from '@/app/store/preview/rendering-path'
import { ColorPalette } from '@/components/color-palette/color-palette'
import { RasterBasePalette } from '@/components/color-palette/raster-base-palette'
import ImageControls from '@/components/image-controls/image-controls'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { ImagePreview } from '@/preview'

const PreviewPanel = () => {
  const renderingPath = useAtomValue(activeRenderingPathAtom)
  const capabilities = useAtomValue(activeRenderingPathCapabilitiesAtom)
  const editorMode = useAtomValue(editorModeAtom)
  const enterEditMode = useSetAtom(enterEditModeAtom)
  const image = useAtomValue(imageAtom)

  const handleEditClick = () => {
    enterEditMode()
  }

  // The editor is offered only by paths that declare it — Mode R produces two
  // frames and two palettes, which the editor cannot represent.
  const canEdit = !editorMode && image && capabilities.editor

  return (
    <Panel>
      <Header
        title={<Trans>Aperçu</Trans>}
        action={canEdit ? handleEditClick : undefined}
        actionLabel={<Trans>Éditer</Trans>}
        icon='Pencil2Icon'
      />

      <ImagePreview />

      {/* Palette below the preview — the raster path shows its pre-raster base
          palette instead of the 16 editable slots. Hidden in editor mode.
          Known wart: Mode R declares `displayPalette: false` yet still falls
          here, showing the standard slots rather than its two frame palettes
          (those live in the Mode R settings section). */}
      {!editorMode &&
        (renderingPath === 'raster' ? <RasterBasePalette /> : <ColorPalette />)}

      {/* Mode controls directly under palette - hide in editor mode */}
      {!editorMode && <ImageControls />}
    </Panel>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
