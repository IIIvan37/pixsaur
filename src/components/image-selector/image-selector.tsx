import { useRef, useEffect, useCallback } from 'react'

import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import { downscaledAtom, srcAtom } from '@/app/store/image/image'
import { useAtom } from 'jotai'
import { ImageSelectorView } from './image-selector-view'
import { downscaleImage } from '@/libs/pixsaur-adapter/io/downscale-image'

export type ImageSelectorProps = {
  canvasWidth: number
  canvasHeight: number
  containerRefCallback: (node: HTMLDivElement | null) => void
}

/**
 * ImageSelector is a React component responsible for displaying an image on a canvas element.
 * It retrieves the image data from a state atom and renders it onto the canvas using the 2D context.
 * The component also handles canvas reference management and image adjustment logic.
 *
 * @param {Object} props - The props for the ImageSelector component.
 * @param {number} props.canvasWidth - The width of the canvas to render the image on.
 * @param {number} props.canvasHeight - The height of the canvas to render the image on.
 * @returns {JSX.Element} The rendered ImageSelectorView component with the canvas and image data.
 */

export function ImageSelector({
  canvasWidth,
  canvasHeight,
  containerRefCallback
}: ImageSelectorProps) {
  const [src] = useAtom(downscaledAtom)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useImageAdjustement()
  const imageRefCallback = useCallback((node: HTMLCanvasElement | null) => {
    if (node) {
      canvasRef.current = node
    }
  }, [])

  useEffect(() => {
    if (canvasRef.current && src) {
      console.log('ImageSelector: src', src)
      const ctx = canvasRef.current.getContext('2d')!
      ctx.putImageData(src, 0, 0)
    }
  }, [src])

  return (
    <ImageSelectorView
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      src={src}
      refCallback={imageRefCallback}
      containerRefCallback={containerRefCallback}
    />
  )
}
