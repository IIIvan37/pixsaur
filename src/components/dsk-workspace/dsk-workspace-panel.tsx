import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { dskImagesAtom } from '@/app/store/dsk-workspace/dsk-workspace'
import {
  previewImageAtom,
  reducedPaletteRgbAtom
} from '@/app/store/preview/preview'
import DskWorkspace from '@/components/dsk-workspace/dsk-workspace'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { sanitizeAmsdosFilename } from '@/utils/amsdos-filename'
import { downloadFile } from '@/utils/download-file'
import { exportDskWorkspace } from '@/utils/exports/exporters/export-dsk-workspace'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'

export default function DskWorkspacePanel() {
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const dskImages = useAtomValue(dskImagesAtom)
  const [isExporting, setIsExporting] = useState(false)

  // Check if we can add current image (must have image and be CPC Classic with standard mode)
  const canAddCurrentImage =
    !!image && cpcHardware === 'classic' && !modeConfig.overscan

  // Prepare current image data for adding to DSK
  const currentImageData = canAddCurrentImage
    ? (() => {
        // Convert palette to firmware indices (same logic as in export-panel.tsx)
        const cpcPalette = getPaletteForHardware(cpcHardware)

        const originalPaletteIndices = reducedPalette.map(
          (colorData: unknown) => {
            const color = Array.isArray(colorData)
              ? colorData
              : Array.from(colorData as ArrayLike<number>)
            const index = cpcPalette.findIndex(
              (c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2]
            )
            if (index === -1) {
              throw new Error(
                `Pixel RGB [${color}] non trouvé dans la palette.`
              )
            }
            return index
          }
        )

        // Mode 0 needs palette reorganization
        const isMode0 = reducedPalette.length === 16
        let paletteFirmware: number[]

        if (isMode0) {
          paletteFirmware = new Array(16).fill(0)
          for (let i = 0; i < originalPaletteIndices.length; i++) {
            const b0 = i & 1
            const b1 = (i >> 1) & 1
            const b2 = (i >> 2) & 1
            const b3 = (i >> 3) & 1
            const correctedIndex = b0 | (b2 << 1) | (b1 << 2) | (b3 << 3)
            paletteFirmware[correctedIndex] = originalPaletteIndices[i]
          }
        } else {
          // Ensure palette has 16 colors (pad with black if needed)
          paletteFirmware = new Array(16).fill(0)
          for (let i = 0; i < originalPaletteIndices.length; i++) {
            paletteFirmware[i] = originalPaletteIndices[i]
          }
        }

        // Generate a timestamped name and sanitize to AMSDOS 8.3 format
        const timestamp = Date.now().toString().slice(-6) // Use last 6 digits
        const suggestedName = `IMG_${timestamp}.SCR`

        return {
          name: sanitizeAmsdosFilename(suggestedName),
          scrData: rgbToIndexBufferExact(image.data, reducedPalette, false),
          mode: modeConfig.mode,
          width: modeConfig.width,
          height: modeConfig.height,
          overscan: modeConfig.overscan,
          nColors: modeConfig.nColors,
          scaleX: modeConfig.scaleX,
          scaleY: modeConfig.scaleY,
          paletteFirmware
        }
      })()
    : undefined

  const handleExport = async () => {
    if (dskImages.length === 0) return

    setIsExporting(true)
    try {
      const dskData = await exportDskWorkspace(dskImages)
      if (dskData) {
        downloadFile(
          dskData,
          'pixsaur-workspace.dsk',
          'application/octet-stream'
        )
      }
    } catch (error) {
      console.error('[DSK Workspace] Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DskWorkspace
      onExport={handleExport}
      currentImageData={currentImageData}
      canAddCurrentImage={canAddCurrentImage && !isExporting}
    />
  )
}
