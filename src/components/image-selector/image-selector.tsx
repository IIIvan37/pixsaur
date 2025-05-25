import { useRef, useEffect, useCallback } from 'react'

import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import { canvasWidthAtom, workingImageAtom } from '@/app/store/image/image'
import { useAtomValue, useSetAtom } from 'jotai'
import { ImageSelectorView } from './image-selector-view'
import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'

/**
 * ImageSelector is a React component responsible for displaying and managing an image canvas.
 *
 * It observes the width of its container and updates the canvas width accordingly using Jotai atoms.
 * The component renders an image onto a canvas element and provides callbacks for referencing
 * both the canvas and its container.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageSelector component.
 *
 * @remarks
 * - Uses Jotai atoms for state management of canvas size and image data.
 * - Utilizes custom hooks for observing container width and image adjustment.
 * - Passes necessary props and ref callbacks to the underlying ImageSelectorView component.
 */
export function ImageSelector() {
  const setWidth = useSetAtom(canvasWidthAtom)
  const containerRefCallback = useObservedCanvasWidth((width) => {
    setWidth(width)
  }, 320)

  const src = useAtomValue(workingImageAtom)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useImageAdjustement()
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
      canvasWidth={src?.width || 0}
      canvasHeight={src?.height || 0}
      src={src}
      refCallback={imageRefCallback}
      containerRefCallback={containerRefCallback}
    />
  )
}
