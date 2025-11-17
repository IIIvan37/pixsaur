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
  previewImageAtom,
  reducedPaletteRgbAtom
} from '@/app/store/preview/preview'
import DskWorkspace from '@/components/dsk-workspace/dsk-workspace'
import { Notification } from '@/components/ui/notification/notification'
import { getPaletteForHardware } from '@/palettes/cpc-palette'
import { sanitizeAmsdosFilename } from '@/utils/amsdos-filename'
import { dskLogger } from '@/utils/core'
import { downloadFile } from '@/utils/download-file'
import { paletteToCPCPlusValues } from '@/utils/exports/cpc-plus-format'
import { saveZipFileTauri } from '@/utils/exports/export-tauri'
import { exportDskWorkspaceZip } from '@/utils/exports/exporters/export-dsk-workspace-zip'
import { rgbToIndexBufferExact } from '@/utils/exports/rgb-to-indexes'
import { isTauri } from '@/utils/is-tauri'

export default function DskWorkspacePanel() {
  const { _ } = useLingui()
  const image = useAtomValue(previewImageAtom)
  const reducedPalette = useAtomValue(reducedPaletteRgbAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const dskImages = useAtomValue(dskImagesAtom)
  const [isExporting, setIsExporting] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  // Check if we can add current image (must have image)
  // We now support all dimensions including overscan and custom
  const canAddCurrentImage = !!image

  // Prepare current image data for adding to DSK
  const currentImageData = canAddCurrentImage
    ? (() => {
        // Convert palette to firmware indices (for CPC Classic) or CPC Plus values
        const cpcPalette = getPaletteForHardware(cpcHardware)

        const paletteFirmware = reducedPalette.map((colorData: unknown) => {
          const color = Array.isArray(colorData)
            ? colorData
            : Array.from(colorData as ArrayLike<number>)
          const index = cpcPalette.findIndex(
            (c) => c[0] === color[0] && c[1] === color[1] && c[2] === color[2]
          )
          if (index === -1) {
            throw new Error(`Pixel RGB [${color}] non trouvé dans la palette.`)
          }
          return index
        })

        // Ensure palette has 16 colors (pad with black if needed)
        while (paletteFirmware.length < 16) {
          paletteFirmware.push(0)
        }

        // For CPC Plus, also generate the 16-bit palette values
        const palettePlus =
          cpcHardware === 'plus'
            ? paletteToCPCPlusValues(
                reducedPalette.map((color: unknown) =>
                  Array.isArray(color)
                    ? (color as [number, number, number])
                    : (Array.from(color as ArrayLike<number>) as [
                        number,
                        number,
                        number
                      ])
                )
              )
            : undefined

        // Generate a timestamped name and sanitize to AMSDOS 8.3 format
        const timestamp = Date.now().toString().slice(-6) // Use last 6 digits
        const suggestedName = `IMG_${timestamp}.SCR`

        // Generate thumbnail (max 120px height) with correct CPC pixel aspect ratio
        const canvas = document.createElement('canvas')
        const maxHeight = 80
        const displayWidth = image.width * modeConfig.scaleX
        const displayHeight = image.height * modeConfig.scaleY
        const scale = maxHeight / displayHeight
        canvas.width = Math.floor(displayWidth * scale)
        canvas.height = Math.floor(displayHeight * scale)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = image.width
          tempCanvas.height = image.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(image, 0, 0)
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
          }
        }
        const thumbnailDataUrl = canvas.toDataURL('image/png')

        // Convert palette to hex colors for display
        const paletteColors = reducedPalette.map((color: unknown) => {
          const rgb = Array.isArray(color)
            ? color
            : Array.from(color as ArrayLike<number>)
          return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
        })

        // Convert RGB to palette indices (not SCR encoded yet)
        // The SCR encoding will be done by generateSCRAsmClassic in export-dsk-workspace
        const indexBuffer = rgbToIndexBufferExact(
          image.data,
          reducedPalette,
          false
        )

        return {
          name: sanitizeAmsdosFilename(suggestedName),
          scrData: indexBuffer,
          mode: modeConfig.mode,
          width: modeConfig.width,
          height: modeConfig.height,
          overscan: modeConfig.overscan,
          nColors: modeConfig.nColors,
          scaleX: modeConfig.scaleX,
          scaleY: modeConfig.scaleY,
          cpcHardware,
          paletteFirmware,
          palettePlus,
          thumbnailDataUrl,
          paletteColors
        }
      })()
    : undefined

  const handleExport = async () => {
    if (dskImages.length === 0) return

    setIsExporting(true)
    try {
      const zipBlob = await exportDskWorkspaceZip(dskImages)
      if (zipBlob) {
        // Check if running in Tauri (desktop) or web
        if (isTauri()) {
          // Use Tauri's native file dialog and save
          const success = await saveZipFileTauri(
            zipBlob,
            'pixsaur-workspace.zip'
          )
          if (success) {
            setNotificationMessage(_(msg`DSK workspace exported successfully!`))
            setShowNotification(true)
          }
        } else {
          // Use browser download
          downloadFile(zipBlob, 'pixsaur-workspace.zip', 'application/zip')
          setNotificationMessage(_(msg`DSK workspace exported successfully!`))
          setShowNotification(true)
        }
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
