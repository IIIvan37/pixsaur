// ImagePreview.tsx

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import {
  effectiveModeConfigAtom,
  smoothingAtom
} from '@/app/store/config/config'
import {
  previewCanvasSizeAtom,
  previewCanvasWidthAtom,
  previewImageAtom
} from '@/app/store/preview/preview'
import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'
import { createCorrectedAspectCanvas } from '@/utils/exports/export-png-utils'
import { isTauri } from '@/utils/is-tauri'
import { ImagePreviewView } from './image-preview-view'

const ImagePreview = () => {
  const { _ } = useLingui()
  const ref = useRef<HTMLCanvasElement>(null)
  const smoothing = useAtomValue(smoothingAtom)
  const previewImage = useAtomValue(previewImageAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)

  const setWidth = useSetAtom(previewCanvasWidthAtom)
  const { width, height } = useAtomValue(previewCanvasSizeAtom)

  const containerRef = useObservedCanvasWidth((proposedWidth) => {
    setWidth(proposedWidth)
  }, 320)

  const draw = useCallback(() => {
    const canvas = ref.current
    if (!canvas || !previewImage || width <= 0 || height <= 0) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = smoothing

    // previewImage est maintenant un ImageData, pas un Canvas
    if (previewImage instanceof ImageData) {
      // Créer un canvas temporaire pour l'ImageData
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = previewImage.width
      tempCanvas.height = previewImage.height
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.putImageData(previewImage, 0, 0)

        // Dessiner le canvas temporaire sur le canvas de destination
        ctx.drawImage(
          tempCanvas,
          0,
          0,
          tempCanvas.width,
          tempCanvas.height,
          0,
          0,
          width,
          height
        )
      }
    }
  }, [previewImage, width, height, smoothing])

  useEffect(() => {
    draw()
  }, [draw])

  const handleCanvasClick = useCallback(async () => {
    if (!previewImage) return

    // In Tauri, don't open in new tab - it would open in system browser
    if (isTauri()) {
      return
    }

    // Create a canvas with the actual image dimensions (not display dimensions)
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = previewImage.width
    sourceCanvas.height = previewImage.height
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return
    sourceCtx.putImageData(previewImage, 0, 0)

    // Create corrected aspect ratio canvas using shared utility
    const correctedCanvas = createCorrectedAspectCanvas(
      sourceCanvas,
      modeConfig
    )

    // Convert to data URL (can be saved directly by browsers)
    const dataUrl = correctedCanvas.toDataURL('image/png')

    // Create an HTML document with the image as data URL
    // Data URLs can be right-clicked and saved with "Save Image As"
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Preview - Pixsaur</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
    img { max-width: 100%; max-height: 100vh; image-rendering: pixelated; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="CPC Preview" download="pixsaur-preview.png" />
</body>
</html>`

    const htmlBlob = new Blob([html], { type: 'text/html' })
    const htmlUrl = URL.createObjectURL(htmlBlob)

    window.open(htmlUrl, '_blank')

    // Clean up after a delay
    setTimeout(() => {
      URL.revokeObjectURL(htmlUrl)
    }, 2000)
  }, [previewImage, modeConfig])

  const tooltip = _(msg`Cliquer pour ouvrir dans un nouvel onglet`)

  return (
    <ImagePreviewView
      containerRefCallback={containerRef}
      ref={ref}
      image={previewImage}
      width={width}
      height={height}
      onClick={isTauri() ? undefined : handleCanvasClick}
      tooltip={isTauri() ? undefined : tooltip}
    />
  )
}

ImagePreview.displayName = 'ImagePreview'
export default ImagePreview
