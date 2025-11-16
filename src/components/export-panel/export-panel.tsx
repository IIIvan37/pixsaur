import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
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
import { Notification } from '@/components/ui/notification/notification'
import { getPaletteForHardware } from '@/palettes/cpc-palette'

import { exportZip } from '@/utils/exports/export-zip'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'
import type { ExportConfig } from '@/utils/exports/types'
import ExportConfigDialog from './export-config-dialog'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const { _ } = useLingui()
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  const handleExport = async (config: ExportConfig) => {
    if (!image?.data) return

    // FIX: Ne pas "nettoyer" l'image - previewImageAtom contient déjà le dithering correct
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
      const originalPaletteIndices = reducedPalette.map((colorData: any) => {
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

      // FIX: Ne pas re-quantifier - l'image contient déjà le bon dithering
      const shouldQuantize = false
      indexBuf = rgbToIndexBufferExact(
        cleanImage.data,
        reducedPalette,
        shouldQuantize
      )

      // Mode 0 (16 colors) needs palette reorganization for Img2CPC format
      // The color index correction is now applied directly in encodeByte for mode 0
      // Modes 1 (4 colors) and 2 (2 colors) work with direct indices
      const isMode0 = reducedPalette.length === 16

      if (isMode0) {
        // Mode 0: Réorganiser la palette pour correspondre aux indices corrigés
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
        // Modes 1 et 2: Utiliser les indices directs
        paletteFirmware = originalPaletteIndices
      }
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
    }

    const canvas = document.createElement('canvas')
    canvas.width = cleanImage.width
    canvas.height = cleanImage.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(cleanImage, 0, 0)

    // Generate ZIP with selected content
    const success = await exportZip(
      indexBuf,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      paletteForExport,
      config
    )

    // Show success message
    if (success) {
      setNotificationMessage(_(msg`File exported successfully!`))
      setShowNotification(true)
    }
  }

  return (
    <>
      <ExportPanelView
        onExport={() => setIsDialogOpen(true)}
        disabled={isDialogOpen}
      />
      <ExportConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleExport}
      />
      <Notification
        message={notificationMessage}
        type='success'
        open={showNotification}
        onOpenChange={setShowNotification}
        autoCloseDuration={3000}
      />
    </>
  )
}
