import { Handle } from './source-selector'
import styles from './source-selector.module.css'
export type SourceSelectorViewProps = {
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  canvasWidth: number
  canvasHeight: number
  hoverHandle: Handle | 'inside' | null
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void
  onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function SourceSelectorView({
  overlayRef,
  canvasWidth,
  canvasHeight,
  hoverHandle,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick
}: SourceSelectorViewProps) {
  const getCursorClass = () => {
    if (hoverHandle === 'top-left' || hoverHandle === 'bottom-right')
      return styles.nwse
    if (hoverHandle === 'top-right' || hoverHandle === 'bottom-left')
      return styles.nesw
    if (hoverHandle === 'inside') return styles.move
    return styles.crosshair
  }
  return (
    <div className={styles.container} style={{ width: '100%', height: 'auto' }}>
      <canvas
        ref={overlayRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.canvas}
      />
      <div
        className={`${styles.overlay} ${getCursorClass()}`}
        style={{ width: canvasWidth, height: canvasHeight }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  )
}
