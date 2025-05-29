import { useRef, useEffect, useCallback } from 'react'

import { useAtomValue } from 'jotai'
import { ImageSelectorView } from './image-selector-view'
import { workingImageAtom } from '@/app/store/image/image'

/**
 * ImageSelector is a React component responsible for rendering and managing an image selection canvas.
 * It retrieves the current working image from a state atom, draws it onto a canvas, and passes relevant
 * properties to the ImageSelectorView component for display.
 *
 * @returns {JSX.Element} The rendered image selector view with the current image.
 *
 * @remarks
 * - Uses `useAtomValue` to access the current image data.
 * - Utilizes a canvas ref to draw the image using the 2D context.
 * - Applies image adjustments via the `useImageAdjustement` hook.
 * - Handles canvas updates when the image source changes.
 */
export function ImageSelector() {

  const src = useAtomValue(workingImageAtom)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const imageRefCallback = useCallback((node: HTMLCanvasElement | null) => {
    if (node) {
      canvasRef.current = node
    }
  }, [])

  useEffect(() => {
    if (canvasRef.current && src) {
      const ctx = canvasRef.current.getContext('2d')!
      ctx.putImageData(src, 0, 0)
    }
  }, [src])

  return (
    <ImageSelectorView
      canvasWidth={src?.width ?? 1}
      canvasHeight={src?.height ?? 1}
      src={src}
      refCallback={imageRefCallback}
    />
  )
}
