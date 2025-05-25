import { useCallback, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { selectionAtom, setSelectionAtom } from '@/app/store/image/image'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'

type Handle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null

/**
 * Converts a logical selection (in image space) to display coordinates in percent.
 *
 * @param sel - The logical selection { sx, sy, width, height }.
 * @param imageWidth - The logical width of the image (e.g. 400).
 * @param imageHeight - The logical height of the image.
 * @returns A rectangle in percent coordinates: { x, y, width, height }.
 */
export function logicalToPercentRect(
  sel: Selection,
  imageWidth: number,
  imageHeight: number
) {
  return {
    x: (sel.sx / imageWidth) * 100,
    y: (sel.sy / imageHeight) * 100,
    width: (sel.width / imageWidth) * 100,
    height: (sel.height / imageHeight) * 100
  }
}

/**
 * Converts a display rectangle (in percent of container) back to logical image coordinates.
 *
 * @param rect - The selection in percent: { x, y, width, height }.
 * @param imageWidth - The logical image width.
 * @param imageHeight - The logical image height.
 * @returns A logical selection { sx, sy, width, height }.
 */
export function percentRectToLogical(
  rect: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): Selection {
  return {
    sx: Math.round((rect.x / 100) * imageWidth),
    sy: Math.round((rect.y / 100) * imageHeight),
    width: Math.round((rect.width / 100) * imageWidth),
    height: Math.round((rect.height / 100) * imageHeight)
  }
}

export type SourceSelectorProps = {
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
}

export const SourceSelector = ({ width, height }: SourceSelectorProps) => {
  const [resizeHandle, setResizeHandle] = useState<Handle>(null)

  const selection = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(setSelectionAtom)

  const [sel, setSel] = useState<Selection>(
    selection ?? { sx: 0, sy: 0, width, height }
  )

  const detectHandleHit = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    return (target.dataset.handle as Handle) || null
  }

  const [dragging, setDragging] = useState(false)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(
    null
  )
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0
  })

  const rect = logicalToPercentRect(sel, width, height)

  const getPercentPos = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const bounds = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - bounds.left) / bounds.width) * 100
    const py = ((e.clientY - bounds.top) / bounds.height) * 100
    return { x: px, y: py }
  }

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const handle = detectHandleHit(e)
      if (handle) {
        setResizeHandle(handle)
        setDragging(true)
        setDragOrigin(getPercentPos(e))
        e.stopPropagation()
        return
      }

      const pos = getPercentPos(e)
      const insideX = pos.x >= rect.x && pos.x <= rect.x + rect.width
      const insideY = pos.y >= rect.y && pos.y <= rect.y + rect.height

      if (insideX && insideY) {
        setDragging(true)
        setDragOrigin(pos)
        setDragOffset({ dx: pos.x - rect.x, dy: pos.y - rect.y })
      }
    },
    [rect]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragging || !dragOrigin) return
      const pos = getPercentPos(e)

      if (resizeHandle) {
        const current = getPercentPos(e)

        // coin opposé (fixe)
        const opposite = {
          x: resizeHandle.includes('left') ? rect.x + rect.width : rect.x,
          y: resizeHandle.includes('top') ? rect.y + rect.height : rect.y
        }

        let newX = resizeHandle.includes('left')
          ? Math.min(current.x, opposite.x - 1)
          : rect.x
        let newY = resizeHandle.includes('top')
          ? Math.min(current.y, opposite.y - 1)
          : rect.y

        let newWidth = Math.abs(opposite.x - current.x)
        let newHeight = Math.abs(opposite.y - current.y)

        newX = Math.max(0, Math.min(newX, 100))
        newY = Math.max(0, Math.min(newY, 100))
        newWidth = Math.min(newWidth, 100 - newX)
        newHeight = Math.min(newHeight, 100 - newY)

        const logical = percentRectToLogical(
          { x: newX, y: newY, width: newWidth, height: newHeight },
          width,
          height
        )
        setSel(logical)
        return
      }

      // Déplacement classique
      const newX = Math.max(
        0,
        Math.min(100 - rect.width, pos.x - dragOffset.dx)
      )
      const newY = Math.max(
        0,
        Math.min(100 - rect.height, pos.y - dragOffset.dy)
      )

      const logical = percentRectToLogical(
        { x: newX, y: newY, width: rect.width, height: rect.height },
        width,
        height
      )

      setSel(logical)
    },
    [dragging, dragOrigin, resizeHandle, rect, dragOffset, width, height]
  )

  const onMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(false)
      setDragOrigin(null)
      setSelection(sel)
      setResizeHandle(null)
    }
  }, [dragging, sel, setSelection])

  const onDoubleClick = useCallback(() => {
    const full = { sx: 0, sy: 0, width, height }
    setSel(full)
    setSelection(full)
  }, [width, height, setSelection])

  const handleSize = 6
  const inset = 4

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
        style={{
          position: 'absolute',
          top: `${rect.y}%`,
          left: `${rect.x}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
          border: '2px solid #00FF00',
          backgroundColor:
            dragging || resizeHandle ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
          boxSizing: 'border-box',
          pointerEvents: 'none'
        }}
      />

      {/* Handles placés à l'intérieur */}
      {(
        [
          { name: 'top-left', dx: 8, dy: 8, cursor: 'nwse-resize' },
          { name: 'top-right', dx: -8, dy: 8, cursor: 'nesw-resize' },
          { name: 'bottom-left', dx: 8, dy: -8, cursor: 'nesw-resize' },
          { name: 'bottom-right', dx: -8, dy: -8, cursor: 'nwse-resize' }
        ] as const
      ).map(({ name, dx, dy, cursor }) => {
        const size = 8
        const half = size / 2
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
