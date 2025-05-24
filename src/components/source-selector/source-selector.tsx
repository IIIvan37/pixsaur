import { useCallback, useEffect, useRef, useState } from 'react'
import { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'

import { useAtomValue, useSetAtom } from 'jotai'
import { selectionAtom, setSelectionAtom } from '@/app/store/image/image'
import { SourceSelectorView } from './source-selector-view'

export type Handle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | null

export type SourceSelectorProps = {
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
}

export const SourceSelector = ({
  width,
  height,
  canvasWidth,
  canvasHeight
}: SourceSelectorProps) => {
  const selection = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [sel, setSel] = useState<Selection>(
    selection || { sx: 0, sy: 0, width: 0, height: 0 }
  )

  const [dragging, setDragging] = useState(false)
  const [moving, setMoving] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<Handle>(null)
  const [hoverHandle, setHoverHandle] = useState<Handle | 'inside' | null>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    const ctx = overlayRef.current!.getContext('2d')!
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    const sx = (sel.sx * canvasWidth) / width
    const sy = (sel.sy * canvasHeight) / height
    const sw = (sel.width * canvasWidth) / width
    const sh = (sel.height * canvasHeight) / height

    // halo
    if (dragging || moving) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
      ctx.fillRect(sx, sy, sw, sh)
    }
    // border
    ctx.strokeStyle = '#00FF00'
    ctx.lineWidth = 2
    ctx.strokeRect(sx, sy, sw, sh)

    // handles inside
    const handleSize = 6
    const inset = 4
    ctx.fillStyle = '#00FF00'
    ctx.fillRect(sx + inset, sy + inset, handleSize, handleSize)
    ctx.fillRect(
      sx + sw - handleSize - inset,
      sy + inset,
      handleSize,
      handleSize
    )
    ctx.fillRect(
      sx + inset,
      sy + sh - handleSize - inset,
      handleSize,
      handleSize
    )
    ctx.fillRect(
      sx + sw - handleSize - inset,
      sy + sh - handleSize - inset,
      handleSize,
      handleSize
    )
  }, [
    sel,
    width,
    height,
    canvasWidth,
    canvasHeight,
    selection,
    dragging,
    moving
  ])

  const toImg = useCallback(
    (cx: number, cy: number) => ({
      x: Math.floor((cx * width) / canvasWidth),
      y: Math.floor((cy * height) / canvasHeight)
    }),
    [width, height, canvasWidth, canvasHeight]
  )

  const detectHandle = useCallback(
    (cx: number, cy: number): Handle => {
      const sx = (sel.sx * canvasWidth) / width
      const sy = (sel.sy * canvasHeight) / height
      const sw = (sel.width * canvasWidth) / width
      const sh = (sel.height * canvasHeight) / height
      const margin = 10

      if (Math.abs(cx - sx) < margin && Math.abs(cy - sy) < margin)
        return 'top-left'
      if (Math.abs(cx - (sx + sw)) < margin && Math.abs(cy - sy) < margin)
        return 'top-right'
      if (Math.abs(cx - sx) < margin && Math.abs(cy - (sy + sh)) < margin)
        return 'bottom-left'
      if (
        Math.abs(cx - (sx + sw)) < margin &&
        Math.abs(cy - (sy + sh)) < margin
      )
        return 'bottom-right'
      return null
    },
    [sel, canvasWidth, canvasHeight, width, height]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const x = overlayRef.current
        ? e.clientX - overlayRef.current.getBoundingClientRect().left
        : 0
      const y = overlayRef.current
        ? e.clientY - overlayRef.current.getBoundingClientRect().top
        : 0
      const p = toImg(x, y)

      const handle = detectHandle(x, y)
      if (handle) {
        setResizeHandle(handle)
        setDragging(true)
      } else if (
        p.x >= sel.sx &&
        p.x <= sel.sx + sel.width &&
        p.y >= sel.sy &&
        p.y <= sel.sy + sel.height
      ) {
        setMoving(true)
        setOffset({ x: p.x - sel.sx, y: p.y - sel.sy })
      } else {
        setStart({ x, y })
        setDragging(true)
      }
    },
    [detectHandle, sel.height, sel.sx, sel.sy, sel.width, toImg]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const x = overlayRef.current
        ? e.clientX - overlayRef.current.getBoundingClientRect().left
        : 0
      const y = overlayRef.current
        ? e.clientY - overlayRef.current.getBoundingClientRect().top
        : 0
      const p = toImg(x, y)

      const handle = detectHandle(x, y)
      if (handle) {
        setHoverHandle(handle)
      } else if (
        p.x >= sel.sx &&
        p.x <= sel.sx + sel.width &&
        p.y >= sel.sy &&
        p.y <= sel.sy + sel.height
      ) {
        setHoverHandle('inside')
      } else {
        setHoverHandle(null)
      }

      if (dragging && start) {
        const p0 = toImg(start.x, start.y)
        const sx = Math.max(0, Math.min(p0.x, p.x))
        const sy = Math.max(0, Math.min(p0.y, p.y))
        const ex = Math.min(width, Math.max(p0.x, p.x))
        const ey = Math.min(height, Math.max(p0.y, p.y))
        const sw = Math.max(10, ex - sx)
        const sh = Math.max(10, ey - sy)
        setSel({ sx, sy, width: sw, height: sh })
      } else if (moving) {
        let newSx = p.x - offset.x
        let newSy = p.y - offset.y
        newSx = Math.max(0, Math.min(newSx, width - sel.width))
        newSy = Math.max(0, Math.min(newSy, height - sel.height))
        setSel({ ...sel, sx: newSx, sy: newSy })
      } else if (resizeHandle) {
        let { sx, sy, width: sw, height: sh } = sel
        if (resizeHandle === 'top-left') {
          sx = Math.min(p.x, sx + sw - 10)
          sy = Math.min(p.y, sy + sh - 10)
          sw = sel.sx + sel.width - sx
          sh = sel.sy + sel.height - sy
        }
        if (resizeHandle === 'top-right') {
          sy = Math.min(p.y, sy + sh - 10)
          sw = Math.max(10, p.x - sx)
          sh = sel.sy + sel.height - sy
        }
        if (resizeHandle === 'bottom-left') {
          sx = Math.min(p.x, sx + sw - 10)
          sw = sel.sx + sel.width - sx
          sh = Math.max(10, p.y - sy)
        }
        if (resizeHandle === 'bottom-right') {
          sw = Math.max(10, p.x - sx)
          sh = Math.max(10, p.y - sy)
        }
        sx = Math.max(0, Math.min(sx, width - 10))
        sy = Math.max(0, Math.min(sy, height - 10))
        sw = Math.min(sw, width - sx)
        sh = Math.min(sh, height - sy)
        setSel({ sx, sy, width: sw, height: sh })
      }
    },
    [
      toImg,
      detectHandle,
      sel,
      dragging,
      start,
      moving,
      resizeHandle,
      width,
      height,
      setSel,
      offset.x,
      offset.y
    ]
  )

  const onMouseUp = useCallback(() => {
    setDragging(false)
    setMoving(false)
    setResizeHandle(null)
    setStart(null)
    setSelection(sel)
  }, [sel, setSelection])

  const onDoubleClick = useCallback(() => {
    const fullSel = { sx: 0, sy: 0, width, height }
    setSel(fullSel)
    setSelection(fullSel)
  }, [width, height, setSelection])

  return (
    <SourceSelectorView
      hoverHandle={hoverHandle}
      overlayRef={overlayRef}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
    />
  )
}
