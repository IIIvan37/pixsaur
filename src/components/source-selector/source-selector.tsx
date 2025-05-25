import { useCallback, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { selectionAtom, setSelectionAtom } from '@/app/store/image/image'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import { Handle, logicalToPercentRect, percentRectToLogical } from './utils'
import { SourceSelectorView } from './source-selector-view'

export type SourceSelectorProps = {
  width: number
  height: number
}

/**
 * SourceSelector is a React component that provides an interactive selection rectangle
 * with draggable and resizable handles for selecting a region within a given area.
 *
 * Features:
 * - Allows users to move and resize a selection rectangle within the bounds of the parent area.
 * - Supports dragging the selection or resizing from any corner handle.
 * - Double-clicking resets the selection to cover the full area.
 * - Visual feedback is provided during drag and resize operations.
 *
 * Props:
 * @param {number} width - The width of the selectable area in logical units.
 * @param {number} height - The height of the selectable area in logical units.
 *
 * Usage:
 * ```tsx
 * <SourceSelector width={800} height={600} />
 * ```
 *
 * @remarks
 * - The component uses Jotai atoms for global selection state management.
 * - Handles are rendered at the four corners of the selection rectangle.
 * - All coordinates and sizes are managed in both logical and percentage units for responsive behavior.
 */
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

  return (
    <SourceSelectorView
      rect={rect}
      dragging={dragging}
      resizeHandle={resizeHandle}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
    />
  )
}
