import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { dskImagesAtom } from '@/app/store/dsk-workspace/dsk-workspace'
import {
  exportPaletteWithSlotsAtom,
  finalPreviewIndexBufferAtom,
  IGNORED_SLOT
} from '@/app/store/preview/preview'
import {
  effectivePreviewImageAtom,
  finalRasterIndexBufferAtom,
  rasterBasePaletteAtom,
  rasterChangesAtom,
  rasterEnabledAtom
} from '@/app/store/raster/raster'
import DskWorkspace from '@/components/dsk-workspace/dsk-workspace'
import { Notification } from '@/components/ui/notification/notification'
import { dskLogger } from '@/core'
import {
  paletteToCPCPlusValues,
  rgbToFirmwareIndex,
  sanitizeAmsdosFilename
} from '@/export'
import { dskWorkspaceBuilder } from '@/export/application/adapters/dsk-workspace-builder'
import { exportDskWorkspaceToZip } from '@/export/application/export-dsk-workspace-to-zip'
import { resolveFileSink } from '@/export/application/file-sink'

export default function DskWorkspacePanel() {
  const { _ } = useLingui()
  // Get final index buffer with manual edits applied (non-raster mode)
  const finalPreviewIndexBuffer = useAtomValue(finalPreviewIndexBufferAtom)
  // Get preview image with rasters and manual edits applied (for thumbnail)
  const previewImageWithEdits = useAtomValue(effectivePreviewImageAtom)
  // Utiliser la palette avec slots pour l'export (conserve les positions des slots vides lockés)
  const exportPalette = useAtomValue(exportPaletteWithSlotsAtom)
  // Get raster-specific palette when raster mode is enabled
  const rasterBasePalette = useAtomValue(rasterBasePaletteAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const dskImages = useAtomValue(dskImagesAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const rasterChanges = useAtomValue(rasterChangesAtom)
  // Get raster index buffer with manual edits applied
  const finalRasterIndexBuffer = useAtomValue(finalRasterIndexBufferAtom)
  const [isExporting, setIsExporting] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  // Check if we can add current image (must have image)
  // We now support all dimensions including overscan and custom
  const canAddCurrentImage = !!finalPreviewIndexBuffer

  // Helper pour vérifier si un slot est ignoré
  const isIgnoredSlot = (color: number[]) =>
    color[0] === IGNORED_SLOT[0] &&
    color[1] === IGNORED_SLOT[1] &&
    color[2] === IGNORED_SLOT[2]

  // Use raster base palette when raster mode is enabled, otherwise use export palette
  // This ensures the exported palette matches what's displayed in the preview
  const effectivePalette =
    rasterEnabled && rasterBasePalette ? rasterBasePalette : exportPalette

  // In raster mode, the palette is already in ink order with no ignored slots
  const useRasterPalette = rasterEnabled && rasterBasePalette

  // Prepare current image data for adding to DSK
  const currentImageData = canAddCurrentImage
    ? (() => {
        // Convert palette to firmware indices (for CPC Classic) or CPC Plus values
        // Use rgbToFirmwareIndex for robust color matching (finds closest CPC color)

        let paletteFirmware: number[]

        if (useRasterPalette) {
          // Raster mode: palette is already in ink order, no ignored slots
          paletteFirmware = effectivePalette.map((colorData: unknown) => {
            const color = Array.isArray(colorData)
              ? colorData
              : Array.from(colorData as ArrayLike<number>)
            return rgbToFirmwareIndex(color[0], color[1], color[2])
          })
        } else {
          // Standard mode: handle ignored slots
          paletteFirmware = effectivePalette.map((colorData: unknown) => {
            const color = Array.isArray(colorData)
              ? colorData
              : Array.from(colorData as ArrayLike<number>)

            // Slot ignoré: utiliser 0 (noir) comme placeholder
            if (isIgnoredSlot(color)) {
              return 0
            }

            return rgbToFirmwareIndex(color[0], color[1], color[2])
          })
        }

        // Ensure palette has 16 colors (pad with black if needed)
        while (paletteFirmware.length < 16) {
          paletteFirmware.push(0)
        }

        // For CPC Plus, also generate the 16-bit palette values
        // In raster mode, no ignored slots to handle
        const palettePlus =
          cpcHardware === 'plus'
            ? paletteToCPCPlusValues(
                effectivePalette.map((color: unknown) => {
                  const c = Array.isArray(color)
                    ? color
                    : Array.from(color as ArrayLike<number>)
                  // Only check for ignored slots in standard mode
                  if (!useRasterPalette && isIgnoredSlot(c)) {
                    return [0, 0, 0] as [number, number, number]
                  }
                  return c as [number, number, number]
                })
              )
            : undefined

        // Generate a timestamped name and sanitize to AMSDOS 8.3 format
        const timestamp = Date.now().toString().slice(-6) // Use last 6 digits
        const suggestedName = `IMG_${timestamp}.SCR`

        // Use the effective index buffer with manual edits applied
        const useRaster = rasterEnabled && finalRasterIndexBuffer
        const indexBufferData = useRaster
          ? finalRasterIndexBuffer
          : finalPreviewIndexBuffer

        // This should never be null since canAddCurrentImage checks for it
        if (!indexBufferData) return undefined

        const { width, height } = indexBufferData

        // Generate thumbnail (max 120px height) with correct CPC pixel aspect ratio
        // Use the preview image with edits applied for accurate thumbnail
        const canvas = document.createElement('canvas')
        const maxHeight = 80
        const displayWidth = width * modeConfig.scaleX
        const displayHeight = height * modeConfig.scaleY
        const scale = maxHeight / displayHeight
        canvas.width = Math.floor(displayWidth * scale)
        canvas.height = Math.floor(displayHeight * scale)
        const ctx = canvas.getContext('2d')
        if (ctx && previewImageWithEdits) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = previewImageWithEdits.width
          tempCanvas.height = previewImageWithEdits.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(previewImageWithEdits, 0, 0)
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
          }
        }
        const thumbnailDataUrl = canvas.toDataURL('image/png')

        // Convert palette to hex colors for display
        // Les slots ignorés sont affichés comme "ignored"
        const paletteColors = effectivePalette.map((color: unknown) => {
          const rgb = Array.isArray(color)
            ? color
            : Array.from(color as ArrayLike<number>)
          // Slot ignoré
          if (isIgnoredSlot(rgb)) {
            return 'ignored'
          }
          return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
        })

        // Use the final index buffer with manual edits already applied
        const indexBuffer = indexBufferData.buffer

        return {
          name: sanitizeAmsdosFilename(suggestedName),
          scrData: indexBuffer,
          mode: modeConfig.mode,
          width,
          height,
          overscan: modeConfig.overscan,
          nColors: modeConfig.nColors,
          scaleX: modeConfig.scaleX,
          scaleY: modeConfig.scaleY,
          cpcHardware,
          paletteFirmware,
          palettePlus,
          thumbnailDataUrl,
          paletteColors,
          // Include raster changes if rasters are enabled
          rasterChanges:
            rasterEnabled && rasterChanges.length > 0
              ? rasterChanges
              : undefined
        }
      })()
    : undefined

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportDskWorkspaceToZip(
        { images: dskImages },
        { dskWorkspaceBuilder, fileSink: resolveFileSink() }
      )

      if (result.ok) {
        setNotificationMessage(_(msg`DSK workspace exported successfully!`))
        setShowNotification(true)
      } else if (
        result.error !== 'save-cancelled' &&
        result.error !== 'no-images'
      ) {
        // An empty workspace and a dismissed save dialog are user choices,
        // not failures — stay silent on both.
        dskLogger.error('[DSK Workspace] Export failed:', result.error)
      }
    } catch (error) {
      dskLogger.error('[DSK Workspace] Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <DskWorkspace
        onExport={handleExport}
        currentImageData={currentImageData}
        canAddCurrentImage={canAddCurrentImage && !isExporting}
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
