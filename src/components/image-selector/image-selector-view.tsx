import { SourceSelector } from '../source-selector'

export type ImageSelectorViewProps = {
  canvasWidth: number
  canvasHeight: number
  src: ImageData | null
  refCallback: (node: HTMLCanvasElement | null) => void
}

/**
 * Renders an image selector view with a canvas and an optional source selector overlay.
 *
 * @param props - The properties for the ImageSelectorView component.
 * @param props.canvasWidth - The width of the canvas element in pixels.
 * @param props.canvasHeight - The height of the canvas element in pixels.
 * @param props.src - The source image object, which may include width, height, and data.
 * @param props.refCallback - A callback ref to access the canvas DOM element.
 *
 * @returns A React element containing a canvas and, if available, a SourceSelector overlay.
 */
export function ImageSelectorView({
  canvasWidth,
  canvasHeight,
  src,
  refCallback
}: ImageSelectorViewProps) {
  const logicalWidth = src?.width ?? 1
  const logicalHeight = src?.height ?? 1

  const aspectRatio = `${logicalWidth} / ${logicalHeight}`

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio
      }}
    >
      <canvas
        ref={refCallback}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {src?.data && (
        <SourceSelector width={logicalWidth} height={logicalHeight} />
      )}
    </div>
  )
}
