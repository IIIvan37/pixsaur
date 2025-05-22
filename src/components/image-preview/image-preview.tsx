import { useEffect, useRef } from 'react'

import { previewImageAtom } from '@/app/store/preview/preview'
import { useAtomValue } from 'jotai'
import { ImagePreviewView } from './image-preview-view'

/**
 * ImagePreview component renders a preview of an image using a canvas element.
 * It listens to the `previewImageAtom` state and updates the canvas whenever the image changes.
 * The image is drawn onto a temporary canvas and then scaled to fit a 320x200 area on the main canvas.
 *
 * @component
 * @returns {JSX.Element} The rendered ImagePreviewView component with the canvas ref and image prop.
 */
const ImagePreview = () => {
  const ref = useRef<HTMLCanvasElement>(null)

  const image = useAtomValue(previewImageAtom)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !image) return

    canvas.width = 320
    canvas.height = 200

    const ctx = canvas.getContext('2d')!

    // Crée un canvas temporaire contenant l’image
    const temp = document.createElement('canvas')
    temp.width = image.width
    temp.height = image.height

    temp.getContext('2d')!.putImageData(image, 0, 0)

    // Étire vers 320x200
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(
      temp,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      320,
      image.height
    )
  }, [image])

  return <ImagePreviewView ref={ref} image={image} />
}

ImagePreview.displayName = 'ImagePreview'

export default ImagePreview
