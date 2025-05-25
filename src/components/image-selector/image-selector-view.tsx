import { SourceSelector } from '../source-selector'

export type ImageSelectorViewProps = {
  canvasWidth: number
  canvasHeight: number
  src: ImageData | null
  refCallback: (node: HTMLCanvasElement | null) => void
  containerRefCallback: (node: HTMLDivElement | null) => void
}

export function ImageSelectorView({
  canvasWidth,
  canvasHeight,
  src,
  refCallback,
  containerRefCallback
}: ImageSelectorViewProps) {
  const logicalWidth = src?.width ?? 1
  const logicalHeight = src?.height ?? 1

  const aspectRatio = `${logicalWidth} / ${logicalHeight}`

  return (
    <div
      ref={containerRefCallback}
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
        <SourceSelector
          width={logicalWidth}
          height={logicalHeight}
          canvasWidth={logicalWidth}
          canvasHeight={logicalHeight}
        />
      )}
    </div>
  )
}
