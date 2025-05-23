import { useEffect, useRef } from 'react'

import {
  previewCanvasSizeAtom,
  previewCanvasWidthAtom,
  previewImageAtom
} from '@/app/store/preview/preview'
import { useAtomValue, useSetAtom } from 'jotai'
import { ImagePreviewView } from './image-preview-view'
import { useObservedCanvasWidth } from '@/hooks/use-observed-canvas-vidth'

/**
 * ImagePreview component renders a preview of an image using a canvas element.
 * It listens to the `previewImageAtom` state and updates the canvas whenever the image changes.
 * The image is drawn onto a temporary canvas and then scaled to fit a 320x200 area on the main canvas.
 *
 * @component
 * @returns {JSX.Element} The rendered ImagePreviewView component with the canvas ref and image prop.
 */
const ImagePreview = () => {
  const { width, height } = useAtomValue(previewCanvasSizeAtom)
  console.log('ImagePreview', width, height)
  const setWidth = useSetAtom(previewCanvasWidthAtom)
  const containerRefCallback = useObservedCanvasWidth((width) => {
    setWidth(width)
  }, 320)
  const ref = useRef<HTMLCanvasElement>(null)

  const image = useAtomValue(previewImageAtom)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !image || !width || !height) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')!

    // Crée un canvas temporaire contenant l’image
    const temp = document.createElement('canvas')
    temp.width = image.width
    temp.height = image.height

    temp.getContext('2d')!.putImageData(image, 0, 0)

    ctx.imageSmoothingEnabled = true
    console.log('HERE', image.width, image.height, width, height)
    ctx.drawImage(temp, 0, 0, image.width, image.height, 0, 0, width, height)
  }, [image, width, height])

  return (
    <ImagePreviewView
      containerRefCallback={containerRefCallback}
      ref={ref}
      image={image}
      width={width}
      height={height}
    />
  )
}

ImagePreview.displayName = 'ImagePreview'

export default ImagePreview
