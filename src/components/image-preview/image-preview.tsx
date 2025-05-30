// ✅ ImagePreview.tsx
import { useRef, useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  previewCanvasSizeAtom,
  previewCanvasWidthAtom,
  previewImageAtom
} from '@/app/store/preview/preview'

import { ImagePreviewView } from './image-preview-view'
import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'

const ImagePreview = () => {
  const ref = useRef<HTMLCanvasElement>(null)

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

    const temp = document.createElement('canvas')
    temp.width = previewImage.width
    temp.height = previewImage.height
    temp.getContext('2d')!.putImageData(previewImage, 0, 0)

    ctx.imageSmoothingEnabled = true

    ctx.drawImage(
      temp,
      0,
      0,
      previewImage.width,
      previewImage.height,
      0,
      0,
      width,
      height
    )
  }, [previewImage, width, height])

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
