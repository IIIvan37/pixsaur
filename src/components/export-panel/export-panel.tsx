import { useAtomValue } from 'jotai'
import { cpcHardwareAtom, modeAtom } from '@/app/store/config/config'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import {
  previewImageAtom,
  reducedPaletteRgbAtom
} from '@/app/store/preview/preview'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { exportZip } from '@/utils/exports/export-zip'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const mode = useAtomValue(modeAtom)

  const onExport = async () => {
    if (!image?.data) return
    
    // Nettoyer l'image pour qu'elle corresponde exactement à la palette
    const { remapImageDataToPalette } = await import('@/utils/exports/rgb-to-indexes')
    const cleanImage = remapImageDataToPalette(image, reducedPalette)
    
    // Utiliser la palette appropriée selon le hardware CPC
    const cpcPalette = getPaletteForHardware(cpcHardware)

    // find indexes of the palette in amstrad cpc palette
    const paletteFirmware = reducedPalette.map((colorData: any) => {
      const color = Array.isArray(colorData) ? colorData : Array.from(colorData)
      const index = cpcPalette.findIndex(
        (c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2]
      )
      if (index === -1) {
        throw new Error(`Pixel RGB [${color}] non trouvé dans la palette.`)
      }
      return index
    })

    // Utiliser la quantization appropriée selon le hardware
    const shouldQuantize = cpcHardware === 'classic'
    const indexBuf = rgbToIndexBufferExact(cleanImage.data, reducedPalette, shouldQuantize)
    const canvas = document.createElement('canvas')

    canvas.width = cleanImage.width
    canvas.height = cleanImage.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(cleanImage, 0, 0)

    const modeConfig = CPC_MODE_CONFIG[mode]
    exportZip(indexBuf, paletteFirmware, canvas, modeConfig)
  }

  return <ExportPanelView onExport={onExport} />
}
