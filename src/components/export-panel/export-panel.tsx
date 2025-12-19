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
import {
  exportToCpcPlayground,
  exportZip,
  generateClassicRasterASM,
  generatePlusRasterASM,
  rgbToCPCPlus,
  rgbToFirmwareIndex,
  rgbToIndexBufferExact
} from '@/export'
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
  const [notificationType, setNotificationType] = useState<'success' | 'error'>(
    'success'
  )
  const [playgroundLoading, setPlaygroundLoading] = useState(false)

  // Helper to check if a slot is ignored
  const isIgnoredSlot = (color: number[]) =>
    color[0] === IGNORED_SLOT[0] &&
    color[1] === IGNORED_SLOT[1] &&
    color[2] === IGNORED_SLOT[2]

  // Get effective palette and index buffer for export
  const getExportData = () => {
    if (!image?.data) return null

    const cleanImage = image

    // Use raster base palette when raster mode is enabled
    const effectivePalette =
      rasterEnabled && rasterBasePalette ? rasterBasePalette : exportPalette

    let indexBuf: Uint8Array
    let paletteFirmware: number[] = []
    let palettePlus: number[] = []

    if (cpcHardware === 'classic') {
      const useRasterPalette = rasterEnabled && rasterBasePalette

      if (useRasterPalette) {
        paletteFirmware = effectivePalette.map((colorData: any) => {
          const color = Array.isArray(colorData)
            ? colorData
            : Array.from(colorData)
          return rgbToFirmwareIndex(color[0], color[1], color[2])
        })
      } else {
        paletteFirmware = effectivePalette.map((colorData: any) => {
          const color = Array.isArray(colorData)
            ? colorData
            : Array.from(colorData)
          if (isIgnoredSlot(color)) return 0
          return rgbToFirmwareIndex(color[0], color[1], color[2])
        })
      }

      if (useRasterPalette && rasterIndexBuffer) {
        indexBuf = rasterIndexBuffer.buffer
      } else {
        indexBuf = rgbToIndexBufferExact(
          cleanImage.data,
          effectivePalette,
          false
        )
      }
    } else {
      // CPC Plus
      const useRasterPalette = rasterEnabled && rasterBasePalette

      // Generate Plus palette (12-bit 0GRB format)
      palettePlus = effectivePalette.map((colorData: any) => {
        const color = Array.isArray(colorData)
          ? colorData
          : Array.from(colorData)
        if (isIgnoredSlot(color)) return 0
        return rgbToCPCPlus(color[0], color[1], color[2])
      })

      if (useRasterPalette && rasterIndexBuffer) {
        indexBuf = rasterIndexBuffer.buffer
      } else {
        indexBuf = rgbToIndexBufferExact(
          cleanImage.data,
          effectivePalette,
          false,
          true
        )
      }
    }

    return {
      indexBuf,
      paletteFirmware,
      palettePlus,
      effectivePalette,
      cleanImage
    }
  }

  const handleExport = async (config: ExportConfig) => {
    const data = getExportData()
    if (!data) return

    const { indexBuf, paletteFirmware, effectivePalette, cleanImage } = data

    const paletteForExport = effectivePalette.map((colorData: any) => {
      const color = Array.isArray(colorData) ? colorData : Array.from(colorData)
      return [color[0], color[1], color[2]] as [number, number, number]
    })

    const canvas = document.createElement('canvas')
    canvas.width = cleanImage.width
    canvas.height = cleanImage.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(cleanImage, 0, 0)

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

    if (success) {
      setNotificationType('success')
      setNotificationMessage(_(msg`File exported successfully!`))
      setShowNotification(true)
    }
  }

  const handleOpenInPlayground = async () => {
    const data = getExportData()
    if (!data) return

    const { indexBuf, paletteFirmware, palettePlus } = data

    setPlaygroundLoading(true)

    try {
      // Generate raster ASM if rasters are enabled
      let rasterAsm: string | undefined
      if (rasterEnabled && rasterChanges && rasterChanges.length > 0) {
        if (cpcHardware === 'classic') {
          rasterAsm = generateClassicRasterASM(
            rasterChanges,
            modeConfig.height,
            paletteFirmware
          )
        } else {
          rasterAsm = generatePlusRasterASM(
            rasterChanges,
            modeConfig.height,
            palettePlus
          )
        }
      }

      const result = await exportToCpcPlayground({
        indexBuf,
        modeConfig,
        hardware: cpcHardware,
        paletteFirmware:
          cpcHardware === 'classic' ? paletteFirmware : undefined,
        palettePlus: cpcHardware === 'plus' ? palettePlus : undefined,
        rasterAsm,
        hasRasters:
          rasterEnabled && !!rasterChanges && rasterChanges.length > 0,
        filename: 'pixsaur'
      })

      if (result.success) {
        setNotificationType('success')
        setNotificationMessage(_(msg`Opened in CPC Playground!`))
        setShowNotification(true)
      } else {
        setNotificationType('error')
        setNotificationMessage(
          _(
            msg`Failed to open in CPC Playground: ${
              result.error ?? 'Unknown error'
            }`
          )
        )
        setShowNotification(true)
      }
    } catch (error) {
      setNotificationType('error')
      setNotificationMessage(
        _(
          msg`Failed to open in CPC Playground: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      )
      setShowNotification(true)
    } finally {
      setPlaygroundLoading(false)
    }
  }

  return (
    <>
      <ExportPanelView
        onExport={() => setIsDialogOpen(true)}
        onOpenInPlayground={handleOpenInPlayground}
        disabled={isDialogOpen || !image?.data}
        playgroundLoading={playgroundLoading}
      />
      <ExportConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleExport}
      />
      <Notification
        message={notificationMessage}
        type={notificationType}
        open={showNotification}
        onOpenChange={setShowNotification}
        autoCloseDuration={3000}
      />
    </>
  )
}
