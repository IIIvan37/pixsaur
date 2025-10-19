import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import styles from './source-selector.module.css'
import type { Handle } from './utils'

export interface SourceSelectorViewProps {
  readonly rect: { x: number; y: number; width: number; height: number }
  readonly dragging: boolean
  readonly resizeHandle: Handle | null
  readonly onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  readonly onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  readonly onMouseUp: () => void
  readonly onDoubleClick: () => void
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
  const { _ } = useLingui()
  const handleSize = 6

  return (
    // biome-ignore lint/a11y/useSemanticElements: Interactive overlay for image selection requiring absolute positioning
    <div
      role='button'
      tabIndex={0}
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
      <section
        data-testid='selection-rect'
        aria-label={_(msg`Zone de sélection`)}
        className={
          styles['selection-rect'] +
          (dragging || resizeHandle
            ? ` ${styles['selection-rect--active']}`
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
          // biome-ignore lint/a11y/useSemanticElements: Resize handle requires precise positioning
          <div
            key={name}
            data-handle={name}
            role='button'
            tabIndex={0}
            aria-label={_(msg`Redimensionner`)}
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
