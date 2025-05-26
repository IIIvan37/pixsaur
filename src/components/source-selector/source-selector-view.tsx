import { Handle } from './utils'
import styles from './source-selector.module.css'

export type SourceSelectorViewProps = {
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  rect: {
    x: number // in percent
    y: number // in percent
    width: number // in percent
    height: number // in percent
  }
  dragging: boolean
  resizeHandle: Handle | null
}
export function SourceSelectorView({
  rect,
  dragging,
  resizeHandle,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick
}: SourceSelectorViewProps) {
  const handleSize = 6

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Rectangle de sélection */}
      <div
        data-testid='selection-rect'
        tabIndex={0}
        role='region'
        aria-label='Zone de sélection'
        className={
          styles['selection-rect'] +
          (dragging || resizeHandle
            ? ' ' + styles['selection-rect--active']
            : '')
        }
        style={{
          position: 'absolute',
          top: `${rect.y}%`,
          left: `${rect.x}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
          boxSizing: 'border-box',
          pointerEvents: 'auto'
        }}
      />

      {/* Handles placés à l'intérieur */}
      {(
        [
          {
            name: 'top-left',
            dx: handleSize,
            dy: handleSize,
            cursor: 'nwse-resize'
          },
          {
            name: 'top-right',
            dx: -handleSize,
            dy: handleSize,
            cursor: 'nesw-resize'
          },
          {
            name: 'bottom-left',
            dx: handleSize,
            dy: -handleSize,
            cursor: 'nesw-resize'
          },
          {
            name: 'bottom-right',
            dx: -handleSize,
            dy: -handleSize,
            cursor: 'nwse-resize'
          }
        ] as const
      ).map(({ name, dx, dy, cursor }) => {
        const size = 8
        const offsetStyle = {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
        }

        const pos = {
          top: name.includes('top') ? `${rect.y}%` : `${rect.y + rect.height}%`,
          left: name.includes('left') ? `${rect.x}%` : `${rect.x + rect.width}%`
        }

        return (
          <div
            key={name}
            data-handle={name}
            tabIndex={0}
            aria-label={`Redimensionner ${name.replace('-', ' ')}`}
            style={{
              position: 'absolute',
              ...pos,
              width: size,
              height: size,
              backgroundColor: '#00FF00',
              cursor,
              zIndex: 3,
              ...offsetStyle
            }}
          />
        )
      })}
    </div>
  )
}
