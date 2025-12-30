import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  modeREnabledAtom
} from '@/app/store/config/config'
import { modeRExportDataAtom } from '@/app/store/preview/mode-r-preview'
import {
  exportPaletteWithSlotsAtom,
  finalPreviewIndexBufferAtom
} from '@/app/store/preview/preview'
import {
  effectivePreviewImageAtom,
  finalRasterIndexBufferAtom,
  rasterBasePaletteAtom,
  rasterChangesAtom,
  rasterEnabledAtom
} from '@/app/store/raster/raster'
import { Notification } from '@/components/ui/notification/notification'
import type { ExportConfig } from '@/export'
import {
  exportModeRToCpcPlayground,
  exportToCpcPlayground,
  exportZip,
  generateClassicRasterASM,
  generatePlusRasterASM
} from '@/export'
import { paletteToCPCPlusValues } from '@/export/exports/cpc-plus-format'
import { rgbToFirmwareIndex } from '@/export/exports/raster-format'
import ExportConfigDialog from './export-config-dialog'
import { prepareExportData } from './export-data-helpers'
import ExportPanelView from './export-panel-view'

export default function ExportPanel() {
  const { _ } = useLingui()
  // Get final index buffer with manual edits applied (non-raster mode)
  const finalPreviewIndexBuffer = useAtomValue(finalPreviewIndexBufferAtom)
  // Get preview image with rasters and manual edits applied (for corrected PNG export)
  const previewImageWithRasters = useAtomValue(effectivePreviewImageAtom)
  // Utiliser la palette avec slots pour l'export (conserve les positions des slots vides lockés)
  const exportPalette = useAtomValue(exportPaletteWithSlotsAtom)
  // Get raster-specific palette when raster mode is enabled
  const rasterBasePalette = useAtomValue(rasterBasePaletteAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  // Get raster index buffer with manual edits applied
  const finalRasterIndexBuffer = useAtomValue(finalRasterIndexBufferAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterChanges = useAtomValue(rasterChangesAtom)
  // Mode R
  const modeREnabled = useAtomValue(modeREnabledAtom)
  const modeRExportData = useAtomValue(modeRExportDataAtom)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState<'success' | 'error'>(
    'success'
  )
  const [playgroundLoading, setPlaygroundLoading] = useState(false)

  // Get effective palette and index buffer for export
  const getExportData = () => {
    return prepareExportData({
      finalPreviewIndexBuffer,
      exportPalette,
      rasterEnabled,
      rasterBasePalette,
      finalRasterIndexBuffer,
      cpcHardware
    })
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

    const success = await exportZip({
      indexBuf,
      paletteFirmware,
      canvas,
      modeConfig,
      cpcHardware,
      reducedPalette: paletteForExport,
      config,
      rasterChanges,
      previewImage: previewImageWithRasters ?? undefined
    })

    if (success) {
      setNotificationType('success')
      setNotificationMessage(_(msg`File exported successfully!`))
      setShowNotification(true)
    }
  }

  const handleOpenInPlayground = async () => {
    setPlaygroundLoading(true)

    try {
      // Mode R export path
      if (modeREnabled && modeRExportData) {
        const isPlus = cpcHardware === 'plus'

        // Convert palettes to appropriate format
        const paletteAFirmware = modeRExportData.paletteA.map((c) =>
          rgbToFirmwareIndex(c[0], c[1], c[2])
        )
        const paletteBFirmware = modeRExportData.paletteB.map((c) =>
          rgbToFirmwareIndex(c[0], c[1], c[2])
        )
        const paletteAPlus = paletteToCPCPlusValues(
          modeRExportData.paletteA.map(
            (c) => [c[0], c[1], c[2]] as [number, number, number]
          )
        )
        const paletteBPlus = paletteToCPCPlusValues(
          modeRExportData.paletteB.map(
            (c) => [c[0], c[1], c[2]] as [number, number, number]
          )
        )

        const result = await exportModeRToCpcPlayground({
          indexBufA: modeRExportData.indexBufferA,
          indexBufB: modeRExportData.indexBufferB,
          modeConfig,
          hardware: cpcHardware,
          paletteAFirmware: !isPlus ? paletteAFirmware : undefined,
          paletteBFirmware: !isPlus ? paletteBFirmware : undefined,
          paletteAPlus: isPlus ? paletteAPlus : undefined,
          paletteBPlus: isPlus ? paletteBPlus : undefined,
          filename: 'pixsaur_modeR'
        })

        if (result.success) {
          setNotificationType('success')
          setNotificationMessage(_(msg`Mode R opened in CPC Playground!`))
          setShowNotification(true)
        } else {
          setNotificationType('error')
          setNotificationMessage(
            _(
              msg`Failed to open Mode R in CPC Playground: ${
                result.error ?? 'Unknown error'
              }`
            )
          )
          setShowNotification(true)
        }
        return
      }

      // Standard export path
      const data = getExportData()
      if (!data) return

      const { indexBuf, paletteFirmware, palettePlus } = data

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

  // Determine if export is available
  const canExport = modeREnabled ? !!modeRExportData : !!finalPreviewIndexBuffer

  return (
    <>
      <ExportPanelView
        onExport={() => setIsDialogOpen(true)}
        onOpenInPlayground={handleOpenInPlayground}
        disabled={isDialogOpen || !canExport}
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
