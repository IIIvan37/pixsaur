import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isSelectionDraggingAtom,
  selectionAtom,
  setSelectionAtom
} from '@/app/store/image/image'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import { SourceSelectorView } from './source-selector-view'
import {
  type Handle,
  logicalToPercentRect,
  percentRectToLogical
} from './utils'

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
export const SourceSelector = ({
  width,
  height
}: Readonly<SourceSelectorProps>) => {
  const [resizeHandle, setResizeHandle] = useState<Handle>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const setContainerRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node
  }, [])

  const selection = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const setIsSelectionDragging = useSetAtom(isSelectionDraggingAtom)

  const [sel, setSel] = useState<Selection>(
    selection ?? { sx: 0, sy: 0, width, height }
  )

  const detectHandleHit = useCallback(
    (
      e: React.MouseEvent,
      selectionRect: { x: number; y: number; width: number; height: number }
    ) => {
      const target = e.currentTarget as HTMLElement
      const bounds = target.getBoundingClientRect()

      // Coordonnées relatives au container (en %)
      const relX = ((e.clientX - bounds.left) / bounds.width) * 100
      const relY = ((e.clientY - bounds.top) / bounds.height) * 100

      // Taille de la zone cliquable autour du handle (en %)
      const tolerance = 5 // 5% tolerance pour faciliter le clic

      // Position des handles en % (basé sur le rectangle de sélection)
      const handles = [
        { name: 'top-left' as Handle, x: selectionRect.x, y: selectionRect.y },
        {
          name: 'top-right' as Handle,
          x: selectionRect.x + selectionRect.width,
          y: selectionRect.y
        },
        {
          name: 'bottom-left' as Handle,
          x: selectionRect.x,
          y: selectionRect.y + selectionRect.height
        },
        {
          name: 'bottom-right' as Handle,
          x: selectionRect.x + selectionRect.width,
          y: selectionRect.y + selectionRect.height
        }
      ]

      // Trouver le handle le plus proche
      for (const handle of handles) {
        const dx = Math.abs(relX - handle.x)
        const dy = Math.abs(relY - handle.y)
        if (dx < tolerance && dy < tolerance) {
          return handle.name
        }
      }

      return null
    },
    []
  )

  const [dragging, setDragging] = useState(false)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(
    null
  )
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0
  })
  const [hoveredHandle, setHoveredHandle] = useState<Handle | null>(null)

  const rect = logicalToPercentRect(sel, width, height)

  // Helper to get percent position from mouse event using the container ref
  const getPercentPosFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      if (!container) return { x: 0, y: 0 }
      const bounds = container.getBoundingClientRect()
      const px = ((clientX - bounds.left) / bounds.width) * 100
      const py = ((clientY - bounds.top) / bounds.height) * 100
      return { x: px, y: py }
    },
    []
  )

  const getPercentPos = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const bounds = e.currentTarget.getBoundingClientRect()
      const px = ((e.clientX - bounds.left) / bounds.width) * 100
      const py = ((e.clientY - bounds.top) / bounds.height) * 100
      return { x: px, y: py }
    },
    []
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const handle = detectHandleHit(e, rect)
      if (handle) {
        setResizeHandle(handle)
        setDragging(true)
        setIsSelectionDragging(true)
        setDragOrigin(getPercentPos(e))
        e.stopPropagation()
        return
      }

      const pos = getPercentPos(e)
      const insideX = pos.x >= rect.x && pos.x <= rect.x + rect.width
      const insideY = pos.y >= rect.y && pos.y <= rect.y + rect.height

      if (insideX && insideY) {
        setDragging(true)
        setIsSelectionDragging(true)
        setDragOrigin(pos)
        setDragOffset({ dx: pos.x - rect.x, dy: pos.y - rect.y })
      }
    },
    [rect, detectHandleHit, getPercentPos, setIsSelectionDragging]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Détecter le survol d'un handle (seulement si pas en train de drag)
      if (!dragging) {
        const handle = detectHandleHit(e, rect)
        setHoveredHandle(handle)
      }
      // Le déplacement pendant le drag est géré par les événements window
    },
    [dragging, rect, detectHandleHit]
  )

  const onMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(false)
      setIsSelectionDragging(false)
      setDragOrigin(null)
      setSelection(sel)
      setResizeHandle(null)
      setHoveredHandle(null)
    }
  }, [dragging, sel, setSelection, setIsSelectionDragging])

  // Use window events during drag so we can track the mouse even outside the container
  useEffect(() => {
    if (!dragging) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragOrigin) return
      const pos = getPercentPosFromEvent(e.clientX, e.clientY)

      if (resizeHandle) {
        // coin opposé (fixe)
        const opposite = {
          x: resizeHandle.includes('left') ? rect.x + rect.width : rect.x,
          y: resizeHandle.includes('top') ? rect.y + rect.height : rect.y
        }

        let newX = resizeHandle.includes('left')
          ? Math.min(pos.x, opposite.x - 1)
          : rect.x
        let newY = resizeHandle.includes('top')
          ? Math.min(pos.y, opposite.y - 1)
          : rect.y

        let newWidth = Math.abs(opposite.x - pos.x)
        let newHeight = Math.abs(opposite.y - pos.y)

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
    }

    const handleWindowMouseUp = () => {
      setDragging(false)
      setIsSelectionDragging(false)
      setDragOrigin(null)
      setSelection(sel)
      setResizeHandle(null)
      setHoveredHandle(null)
    }

    globalThis.addEventListener('mousemove', handleWindowMouseMove)
    globalThis.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      globalThis.removeEventListener('mousemove', handleWindowMouseMove)
      globalThis.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [
    dragging,
    dragOrigin,
    resizeHandle,
    rect,
    dragOffset,
    width,
    height,
    sel,
    setSelection,
    setIsSelectionDragging,
    getPercentPosFromEvent
  ])

  const onMouseLeave = useCallback(() => {
    // Réinitialiser le hover quand on quitte la zone
    setHoveredHandle(null)
  }, [])

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
      hoveredHandle={hoveredHandle}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      logicalWidth={width}
      logicalHeight={height}
      containerRef={setContainerRef}
    />
  )
}
