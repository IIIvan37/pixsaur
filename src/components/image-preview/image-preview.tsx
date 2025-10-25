// ✅ ImagePreview.tsx

import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import { smoothingAtom } from '@/app/store/config/config'
import {
  previewCanvasSizeAtom,
  previewCanvasWidthAtom,
  previewImageAtom
} from '@/app/store/preview/preview'
import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'
import { ImagePreviewView } from './image-preview-view'

const ImagePreview = () => {
  const ref = useRef<HTMLCanvasElement>(null)
  const smoothing = useAtomValue(smoothingAtom)
  const previewImage = useAtomValue(previewImageAtom)

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

        console.log('🖼️ [IMAGE PREVIEW DRAW]', {
          sourceWidth: tempCanvas.width,
          sourceHeight: tempCanvas.height,
          destWidth: width,
          destHeight: height,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        })

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

  return (
    <ImagePreviewView
      containerRefCallback={containerRef}
      ref={ref}
      image={previewImage}
      width={width}
      height={height}
    />
  )
}

ImagePreview.displayName = 'ImagePreview'
export default ImagePreview
