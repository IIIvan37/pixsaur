import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import {
  previewImageAtom,
  reducedPaletteRgbAtom
} from '@/app/store/preview/preview'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { correctColorIndicesForCPC } from '@/utils/exports/correct-indices'
import { exportZip } from '@/utils/exports/export-zip'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'
import type { ExportConfig } from '@/utils/exports/types'
import ExportConfigDialog from './export-config-dialog'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleExport = async (config: ExportConfig) => {
    if (!image?.data) return

    // ✅ FIX: Ne pas "nettoyer" l'image - previewImageAtom contient déjà le dithering correct
    // const { remapImageDataToPalette } = await import('@/utils/exports/rgb-to-indexes')
    // const cleanImage = remapImageDataToPalette(image, reducedPalette)
    const cleanImage = image // Utiliser directement l'image avec dithering

    // Convert palette to the correct format for export
    const paletteForExport = reducedPalette.map((colorData: any) => {
      const color = Array.isArray(colorData) ? colorData : Array.from(colorData)
      return [color[0], color[1], color[2]] as [number, number, number]
    })

    // For CPC Classic, we still need firmware palette mapping and index buffer
    // For CPC Plus, we use index buffer but export GRB palette instead of firmware/hardware
    let indexBuf: Uint8Array
    let paletteFirmware: number[] = []

    if (cpcHardware === 'classic') {
      // CPC Classic: Use palette mapping and index buffer
      const cpcPalette = getPaletteForHardware(cpcHardware)

      // Find indexes of the palette in amstrad cpc palette
      paletteFirmware = reducedPalette.map((colorData: any) => {
        const color = Array.isArray(colorData)
          ? colorData
          : Array.from(colorData)
        const index = cpcPalette.findIndex(
          (c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2]
        )
        if (index === -1) {
          throw new Error(`Pixel RGB [${color}] non trouvé dans la palette.`)
        }
        return index
      })

      // ✅ FIX: Ne pas re-quantifier - l'image contient déjà le bon dithering
      const shouldQuantize = false
      indexBuf = rgbToIndexBufferExact(
        cleanImage.data,
        reducedPalette,
        shouldQuantize
      )

      // 🔧 FIX: Corriger les indices pour correspondre au format Img2CPC (échange bits 1-2)
      indexBuf = correctColorIndicesForCPC(indexBuf)
    } else {
      // CPC Plus: Use index buffer (same as Classic) but no firmware palette needed
      // The palette will be exported as GRB values instead
      const shouldQuantize = false // CPC Plus peut utiliser toutes les couleurs RGB
      const fallbackToDarkest = true // Use darkest color for missing colors (padding)
      indexBuf = rgbToIndexBufferExact(
        cleanImage.data,
        reducedPalette,
        shouldQuantize,
        fallbackToDarkest
      )

      // 🔧 FIX: Corriger les indices pour correspondre au format Img2CPC (échange bits 1-2)
      indexBuf = correctColorIndicesForCPC(indexBuf)
    }

    const canvas = document.createElement('canvas')
    canvas.width = cleanImage.width
    canvas.height = cleanImage.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(cleanImage, 0, 0)

    // Generate ZIP with selected content
    exportZip(
      indexBuf,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      paletteForExport,
      config
    )
  }

  return (
    <>
      <ExportPanelView onExport={() => setIsDialogOpen(true)} />
      <ExportConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleExport}
      />
    </>
  )
}
