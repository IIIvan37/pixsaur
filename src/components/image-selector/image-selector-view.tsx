import { SourceSelector } from '../source-selector'

export type ImageSelectorViewProps = {
  canvasWidth: number
  canvasHeight: number
  src: ImageData | null
  refCallback: (node: HTMLCanvasElement | null) => void
  containerRefCallback: (node: HTMLDivElement | null) => void
}

/**
 * Renders an image selector view with a canvas and an optional source selector overlay.
 *
 * @param props - The properties for the ImageSelectorView component.
 * @param props.canvasWidth - The width of the canvas in pixels.
 * @param props.canvasHeight - The height of the canvas in pixels.
 * @param props.src - The source image data and its dimensions. If present, the SourceSelector is rendered.
 * @param props.refCallback - A callback ref for accessing the canvas DOM element.
 *
 * @returns A React element containing a canvas and, if image data is provided, a SourceSelector overlay.
 */
export function ImageSelectorView({
  canvasWidth,
  canvasHeight,
  src,
  refCallback,
  containerRefCallback
}: ImageSelectorViewProps) {
  return (
    <div
      ref={containerRefCallback}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: '320px',
        height: `${canvasHeight}px`
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
          height: 'auto'
        }}
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
