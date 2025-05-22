import { setCanvasWidth } from '@/app/store/image/image'
import { useSetAtom } from 'jotai'
import { useRef, useCallback } from 'react'

export function useObservedCanvasWidth(min = 320) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const setWidth = useSetAtom(setCanvasWidth)

  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (node) {
        observerRef.current = new ResizeObserver(([entry]) => {
          const width = Math.max(Math.floor(entry.contentRect.width), min)
          setWidth(width)
        })
        observerRef.current.observe(node)
      }
    },
    [setWidth, min]
  )

  return containerRefCallback
}
