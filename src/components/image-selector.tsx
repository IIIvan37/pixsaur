import { useRef, useEffect, useCallback } from 'react'
import { SourceSelector } from './source-selector'

import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import { srcAtom } from '@/app/store/image/image'
import { useAtom } from 'jotai'

export type ImageSelectorProps = {
  canvasWidth: number
  canvasHeight: number
}

export const ImageSelector = ({
  canvasWidth,
  canvasHeight
}: ImageSelectorProps) => {
  const [src] = useAtom(srcAtom)

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
    <div
      style={{
        position: 'relative',
        width: canvasWidth,
        height: canvasHeight
      }}
    >
      <canvas
        ref={imageRefCallback}
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {src?.data ? (
        <SourceSelector
          width={src.width}
          height={src.height}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      ) : null}
    </div>
  )
}
