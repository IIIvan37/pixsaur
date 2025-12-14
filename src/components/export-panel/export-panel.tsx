import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import {
  exportPaletteWithSlotsAtom,
  IGNORED_SLOT,
  previewImageAtom
} from '@/app/store/preview/preview'
import {
  effectivePreviewImageAtom,
  rasterBasePaletteAtom,
  rasterChangesAtom,
  rasterEnabledAtom,
  rasterIndexBufferAtom
} from '@/app/store/raster/raster'
import { Notification } from '@/components/ui/notification/notification'
import type { ExportConfig } from '@/export'
import { exportZip, rgbToFirmwareIndex, rgbToIndexBufferExact } from '@/export'
import ExportConfigDialog from './export-config-dialog'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const { _ } = useLingui()
  const image = useAtomValue(previewImageAtom)
  // Get preview image with rasters already applied (for corrected PNG export)
  const previewImageWithRasters = useAtomValue(effectivePreviewImageAtom)
  // Utiliser la palette avec slots pour l'export (conserve les positions des slots vides lockés)
  const exportPalette = useAtomValue(exportPaletteWithSlotsAtom)
  // Get raster-specific palette when raster mode is enabled
  const rasterBasePalette = useAtomValue(rasterBasePaletteAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  // Get raster index buffer (already optimized with correct ink assignments)
  const rasterIndexBuffer = useAtomValue(rasterIndexBufferAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterChanges = useAtomValue(rasterChangesAtom)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  const handleExport = async (config: ExportConfig) => {
    if (!image?.data) return

    // FIX: Ne pas "nettoyer" l'image - previewImageAtom contient déjà le dithering correct
    // const { remapImageDataToPalette } = await import('@/export')
    // const cleanImage = remapImageDataToPalette(image, reducedPalette)
    const cleanImage = image // Utiliser directement l'image avec dithering

    // Helper pour vérifier si un slot est ignoré
    const isIgnoredSlot = (color: number[]) =>
      color[0] === IGNORED_SLOT[0] &&
      color[1] === IGNORED_SLOT[1] &&
      color[2] === IGNORED_SLOT[2]

    // Use raster base palette when raster mode is enabled, otherwise use export palette
    // This ensures the exported palette matches what's displayed in the preview
    const effectivePalette =
      rasterEnabled && rasterBasePalette ? rasterBasePalette : exportPalette

    // Convert palette to the correct format for export
    // Les slots ignorés [-1,-1,-1] sont conservés pour marquer leur position
    const paletteForExport = effectivePalette.map((colorData: any) => {
      const color = Array.isArray(colorData) ? colorData : Array.from(colorData)
      return [color[0], color[1], color[2]] as [number, number, number]
    })

    // For CPC Classic, we still need firmware palette mapping and index buffer
    // For CPC Plus, we use index buffer but export GRB palette instead of firmware/hardware
    let indexBuf: Uint8Array
    let paletteFirmware: number[] = []

    if (cpcHardware === 'classic') {
      // CPC Classic: Use palette mapping and index buffer

      // In raster mode, the palette is already in ink order (ink 0, ink 1, etc.)
      // and there are no ignored slots - just convert RGB to firmware indices
      const useRasterPalette = rasterEnabled && rasterBasePalette

      if (useRasterPalette) {
        // Raster mode: palette is already in ink order, no reorganization needed
        paletteFirmware = effectivePalette.map((colorData: any) => {
          const color = Array.isArray(colorData)
            ? colorData
            : Array.from(colorData)
          return rgbToFirmwareIndex(color[0], color[1], color[2])
        })
      } else {
        // Standard mode: handle ignored slots and Mode 0 reorganization
        // Find indexes of the palette in amstrad cpc palette
        // Use rgbToFirmwareIndex for robust color matching (finds closest CPC color)
        // Les slots ignorés [-1,-1,-1] utilisent l'indice 0 (noir) comme placeholder
        const originalPaletteIndices = effectivePalette.map(
          (colorData: any) => {
            const color = Array.isArray(colorData)
              ? colorData
              : Array.from(colorData)

            // Slot ignoré: utiliser 0 (noir) comme placeholder
            if (isIgnoredSlot(color)) {
              return 0
            }

            // Use rgbToFirmwareIndex to find closest CPC color index
            return rgbToFirmwareIndex(color[0], color[1], color[2])
          }
        )

        // Mode 0 (16 colors) needs palette reorganization for Img2CPC format
        // The color index correction is now applied directly in encodeByte for mode 0
        // Modes 1 (4 colors) and 2 (2 colors) work with direct indices
        const isMode0 = effectivePalette.length === 16

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
      }

      // In raster mode, use the optimized index buffer from raster optimization
      // This ensures ink indices match the raster changes
      if (useRasterPalette && rasterIndexBuffer) {
        indexBuf = rasterIndexBuffer.buffer
      } else {
        // FIX: Ne pas re-quantifier - l'image contient déjà le bon dithering
        const shouldQuantize = false
        indexBuf = rgbToIndexBufferExact(
          cleanImage.data,
          effectivePalette,
          shouldQuantize
        )
      }
    } else {
      // CPC Plus: Use index buffer (same as Classic) but no firmware palette needed
      // The palette will be exported as GRB values instead
      const shouldQuantize = false // CPC Plus peut utiliser toutes les couleurs RGB
      const fallbackToDarkest = true // Use darkest color for missing colors (padding)
      indexBuf = rgbToIndexBufferExact(
        cleanImage.data,
        effectivePalette,
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
    // Pass previewImageWithRasters for correct PNG export with rasters
    const success = await exportZip(
      indexBuf,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      paletteForExport,
      config,
      rasterChanges,
      previewImageWithRasters ?? undefined
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
        disabled={isDialogOpen || !image?.data}
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
