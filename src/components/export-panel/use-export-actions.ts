/**
 * React adapter hook for the export feature.
 *
 * Owns the atom→input wiring and port injection for the two export use-cases
 * (`exportImageToZip`, `openImageInPlayground`), plus the notification + loading
 * UI state, so `export-panel.tsx` stays thin UI. The use-cases themselves are
 * pure (`src/export/application/`); this hook is the impure seam that reads
 * Jotai atoms, injects the real ports, and maps results to localized messages.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  modeREnabledAtom
} from '@/app/store/config/config'
import { effectivePreviewImageAtom } from '@/app/store/preview/effective-rendering'
import { egxExportDataAtom } from '@/app/store/preview/egx-preview'
import { modeRExportDataAtom } from '@/app/store/preview/mode-r-preview'
import {
  exportPaletteWithSlotsAtom,
  finalPreviewIndexBufferAtom
} from '@/app/store/preview/preview'
import {
  finalRasterIndexBufferAtom,
  rasterBasePaletteAtom,
  rasterChangesAtom,
  rasterEnabledAtom
} from '@/app/store/raster/raster'
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
import { prepareExportData } from './export-data-helpers'

export type NotificationType = 'success' | 'error'

export interface ExportNotificationState {
  message: string
  type: NotificationType
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface UseExportActions {
  /** Whether the current state has exportable data. */
  canExport: boolean
  /** Whether a CPC Playground upload is in flight. */
  playgroundLoading: boolean
  /** Export the current image to a ZIP bundle. */
  handleExport: (config: ExportConfig) => Promise<void>
  /** Upload the current image to CPC Playground and open its share URL. */
  handleOpenInPlayground: () => Promise<void>
  /** Notification state to bind to the `<Notification />` component. */
  notification: ExportNotificationState
}

export function useExportActions(): UseExportActions {
  const { _ } = useLingui()
  // Final index buffer with manual edits applied (non-raster mode)
  const finalPreviewIndexBuffer = useAtomValue(finalPreviewIndexBufferAtom)
  // Preview image with rasters and manual edits applied (for corrected PNG export)
  const previewImageWithRasters = useAtomValue(effectivePreviewImageAtom)
  // Palette with slots for export (keeps empty locked slot positions)
  const exportPalette = useAtomValue(exportPaletteWithSlotsAtom)
  // Raster-specific palette when raster mode is enabled
  const rasterBasePalette = useAtomValue(rasterBasePaletteAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  // Raster index buffer with manual edits applied
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

  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] =
    useState<NotificationType>('success')
  const [playgroundLoading, setPlaygroundLoading] = useState(false)

  const notify = useCallback((type: NotificationType, message: string) => {
    setNotificationType(type)
    setNotificationMessage(message)
    setShowNotification(true)
  }, [])

  const getExportData = useCallback(
    () =>
      prepareExportData({
        finalPreviewIndexBuffer,
        exportPalette,
        rasterEnabled,
        rasterBasePalette,
        finalRasterIndexBuffer,
        cpcHardware
      }),
    [
      finalPreviewIndexBuffer,
      exportPalette,
      rasterEnabled,
      rasterBasePalette,
      finalRasterIndexBuffer,
      cpcHardware
    ]
  )

  const handleExport = useCallback(
    async (config: ExportConfig) => {
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
        notify('success', _(msg`File exported successfully!`))
      }
    },
    [
      _,
      egxEnabled,
      egxExportData,
      getExportData,
      rasterChanges,
      previewImageWithRasters,
      modeConfig,
      cpcHardware,
      notify
    ]
  )

  const handleOpenInPlayground = useCallback(async () => {
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
        notify('success', playgroundSuccessMessage(_, result.mode))
      } else if (result.mode) {
        notify('error', playgroundErrorMessage(_, result.mode, result.error))
      }
    } catch (error) {
      notify(
        'error',
        _(
          msg`Failed to open in CPC Playground: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      )
    } finally {
      setPlaygroundLoading(false)
    }
  }, [
    _,
    modeREnabled,
    modeRExportData,
    egxEnabled,
    egxExportData,
    getExportData,
    rasterEnabled,
    rasterChanges,
    modeConfig,
    cpcHardware,
    notify
  ])

  const fallbackCanExport = egxEnabled
    ? !!egxExportData
    : !!finalPreviewIndexBuffer
  const canExport = modeREnabled ? !!modeRExportData : fallbackCanExport

  return {
    canExport,
    playgroundLoading,
    handleExport,
    handleOpenInPlayground,
    notification: {
      message: notificationMessage,
      type: notificationType,
      open: showNotification,
      onOpenChange: setShowNotification
    }
  }
}

type Translate = ReturnType<typeof useLingui>['_']

function playgroundSuccessMessage(_: Translate, mode: PlaygroundMode): string {
  switch (mode) {
    case 'modeR':
      return _(msg`Mode R opened in CPC Playground!`)
    case 'egx':
      return _(msg`EGX opened in CPC Playground!`)
    default:
      return _(msg`Opened in CPC Playground!`)
  }
}

function playgroundErrorMessage(
  _: Translate,
  mode: PlaygroundMode,
  error: string
): string {
  switch (mode) {
    case 'modeR':
      return _(msg`Failed to open Mode R in CPC Playground: ${error}`)
    case 'egx':
      return _(msg`Failed to open EGX in CPC Playground: ${error}`)
    default:
      return _(msg`Failed to open in CPC Playground: ${error}`)
  }
}
