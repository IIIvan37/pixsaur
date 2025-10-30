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

  const handleCanvasClick = useCallback(() => {
    if (!previewImage) return

    // Check if running in Tauri
    const isTauri =
      typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis

    if (isTauri) {
      // In Tauri, don't open in new tab - it would open in system browser
      return
    }

    // Calculate aspect ratio correction based on mode
    const widthMultiplier = modeConfig.mode === 0 ? 2 : 1
    const heightMultiplier = modeConfig.mode === 2 ? 2 : 1

    // Create a canvas with the actual image dimensions (not display dimensions)
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = previewImage.width
    sourceCanvas.height = previewImage.height
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return
    sourceCtx.putImageData(previewImage, 0, 0)

    // Create corrected aspect ratio canvas
    const correctedCanvas = document.createElement('canvas')
    correctedCanvas.width = previewImage.width * widthMultiplier
    correctedCanvas.height = previewImage.height * heightMultiplier

    const correctedCtx = correctedCanvas.getContext('2d', { alpha: false })
    if (correctedCtx) {
      correctedCtx.fillStyle = '#000000'
      correctedCtx.fillRect(0, 0, correctedCanvas.width, correctedCanvas.height)
      correctedCtx.imageSmoothingEnabled = false
      correctedCtx.drawImage(
        sourceCanvas,
        0,
        0,
        previewImage.width,
        previewImage.height,
        0,
        0,
        correctedCanvas.width,
        correctedCanvas.height
      )

      // Open in new tab
      correctedCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
          // Clean up after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      }, 'image/png')
    }
  }, [previewImage, modeConfig.mode])

  const tooltip = _(msg`Cliquer pour ouvrir dans un nouvel onglet`)

  return (
    <ImagePreviewView
      containerRefCallback={containerRef}
      ref={ref}
      image={previewImage}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      tooltip={tooltip}
    />
  )
}

ImagePreview.displayName = 'ImagePreview'
export default ImagePreview
