import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { RefCallback } from 'react'
import { useMemo } from 'react'
import styles from './source-selector.module.css'
import type { Handle } from './utils'

export interface SourceSelectorViewProps {
  readonly rect: { x: number; y: number; width: number; height: number }
  readonly dragging: boolean
  readonly resizeHandle: Handle | null
  readonly hoveredHandle: Handle | null
  readonly onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  readonly onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  readonly onMouseUp: () => void
  readonly onMouseLeave: () => void
  readonly onDoubleClick: () => void
  readonly logicalWidth?: number
  readonly logicalHeight?: number
  readonly containerRef?: RefCallback<HTMLElement>
}
export function SourceSelectorView({
  rect,
  dragging,
  resizeHandle,
  hoveredHandle,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onDoubleClick,
  logicalWidth,
  logicalHeight,
  containerRef
}: SourceSelectorViewProps) {
  const { _ } = useLingui()
  const handleSize = 6

  // Déterminer le curseur en fonction du handle actif ou survolé
  const cursor = useMemo(() => {
    const activeHandle = resizeHandle || hoveredHandle
    if (!activeHandle) return 'crosshair'

    switch (activeHandle) {
      case 'top-left':
      case 'bottom-right':
        return 'nwse-resize'
      case 'top-right':
      case 'bottom-left':
        return 'nesw-resize'
      default:
        return 'crosshair'
    }
  }, [resizeHandle, hoveredHandle])

  /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
  return (
    <section
      ref={containerRef}
      aria-label={_(msg`Zone de sélection interactive`)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        cursor
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
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
          // Resize handle - pure visual indicator controlled by parent mouse events
          <div
            key={name}
            data-handle={name}
            aria-hidden='true'
            style={{
              position: 'absolute',
              ...pos,
              width: size,
              height: size,
              backgroundColor: '#00FF00',
              cursor,
              zIndex: 3,
              ...offsetStyle,
              pointerEvents: 'none'
            }}
          />
        )
      })}

      {/* Dimensions label */}
      {logicalWidth !== undefined && logicalHeight !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: `${rect.y + rect.height}%`,
            left: `${rect.x}%`,
            transform: 'translateY(4px)',
            padding: '2px 6px',
            backgroundColor: 'rgba(0, 255, 0, 0.9)',
            color: '#000',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'monospace',
            borderRadius: '2px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 4
          }}
        >
          {Math.round((rect.width / 100) * logicalWidth)} ×{' '}
          {Math.round((rect.height / 100) * logicalHeight)}
        </div>
      )}
    </section>
  )
}
