import {
  previewImageAtom,
  reducedPaletteRgbAtom
} from '@/app/store/preview/preview'
import { useAtomValue } from 'jotai'
import { exportZip } from '@/utils/exports/export-zip'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import { modeAtom } from '@/app/store/config/config'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const mode = useAtomValue(modeAtom)

  const onExport = () => {
    if (!image?.data) return
    const cpcPalette = generateAmstradCPCPalette()

    // find indexes of the palette in amstrad cpc palette
    const paletteFirmware = reducedPalette.map((color) => {
      const index = cpcPalette.findIndex(
        (c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2]
      )
      if (index === -1) {
        throw new Error(`Pixel RGB [${color}] non trouvé dans la palette.`)
      }
      return index
    })

    const indexBuf = rgbToIndexBufferExact(image.data, reducedPalette)
    const canvas = document.createElement('canvas')

    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(image, 0, 0)

    const modeConfig = CPC_MODE_CONFIG[mode]
    exportZip(indexBuf, paletteFirmware, canvas, modeConfig)
  }

  return <ExportPanelView onExport={onExport} />
}
