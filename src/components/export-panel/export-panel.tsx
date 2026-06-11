import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  modeREnabledAtom
} from '@/app/store/config/config'
import { egxExportDataAtom } from '@/app/store/preview/egx-preview'
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
import { cpcPlaygroundExporter } from '@/export/application/adapters/cpc-playground-exporter'
import { domCanvasFactory } from '@/export/application/adapters/dom-canvas-factory'
import {
  type ExportImageToZipInput,
  exportImageToZip
} from '@/export/application/export-image-to-zip'
import { resolveFileSink } from '@/export/application/file-sink'
import {
  type OpenImageInPlaygroundInput,
  openImageInPlayground,
  type PlaygroundMode
} from '@/export/application/open-image-in-playground'
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
  // EGX
  const egxEnabled = useAtomValue(egxEnabledAtom)
  const egxExportData = useAtomValue(egxExportDataAtom)
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
    const egx = egxEnabled && egxExportData ? egxExportData : null

    let standard: ExportImageToZipInput['standard'] = null
    if (!egx) {
      const data = getExportData()
      if (data) {
        standard = {
          indexBuf: data.indexBuf,
          paletteFirmware: data.paletteFirmware,
          effectivePalette: data.effectivePalette,
          cleanImage: data.cleanImage,
          rasterChanges,
          previewImage: previewImageWithRasters ?? undefined
        }
      }
    }

    const result = await exportImageToZip(
      { modeConfig, cpcHardware, config, egx, standard },
      { canvasFactory: domCanvasFactory, fileSink: resolveFileSink() }
    )

    if (result.ok) {
      setNotificationType('success')
      setNotificationMessage(_(msg`File exported successfully!`))
      setShowNotification(true)
    }
  }

  const playgroundSuccessMessage = (mode: PlaygroundMode) => {
    switch (mode) {
      case 'modeR':
        return _(msg`Mode R opened in CPC Playground!`)
      case 'egx':
        return _(msg`EGX opened in CPC Playground!`)
      default:
        return _(msg`Opened in CPC Playground!`)
    }
  }

  const playgroundErrorMessage = (mode: PlaygroundMode, error: string) => {
    switch (mode) {
      case 'modeR':
        return _(msg`Failed to open Mode R in CPC Playground: ${error}`)
      case 'egx':
        return _(msg`Failed to open EGX in CPC Playground: ${error}`)
      default:
        return _(msg`Failed to open in CPC Playground: ${error}`)
    }
  }

  const handleOpenInPlayground = async () => {
    setPlaygroundLoading(true)

    try {
      const modeR =
        modeREnabled && modeRExportData
          ? {
              indexBufferA: modeRExportData.indexBufferA,
              indexBufferB: modeRExportData.indexBufferB,
              paletteA: modeRExportData.paletteA,
              paletteB: modeRExportData.paletteB
            }
          : null

      const egx =
        !modeR && egxEnabled && egxExportData
          ? {
              indexBuffer: egxExportData.indexBuffer,
              palette: egxExportData.palette,
              width: egxExportData.width,
              height: egxExportData.height,
              config: egxExportData.config
            }
          : null

      let standard: OpenImageInPlaygroundInput['standard'] = null
      if (!modeR && !egx) {
        const data = getExportData()
        if (data) {
          standard = {
            indexBuf: data.indexBuf,
            paletteFirmware: data.paletteFirmware,
            palettePlus: data.palettePlus,
            rasterChanges: rasterEnabled ? rasterChanges : undefined
          }
        }
      }

      const result = await openImageInPlayground(
        { modeConfig, cpcHardware, modeR, egx, standard },
        { exporter: cpcPlaygroundExporter }
      )

      if (result.ok) {
        setNotificationType('success')
        setNotificationMessage(playgroundSuccessMessage(result.mode))
        setShowNotification(true)
      } else if (result.mode) {
        setNotificationType('error')
        setNotificationMessage(
          playgroundErrorMessage(result.mode, result.error)
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
  const getCanExport = () => {
    if (modeREnabled) return !!modeRExportData
    if (egxEnabled) return !!egxExportData
    return !!finalPreviewIndexBuffer
  }
  const canExport = getCanExport()

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
