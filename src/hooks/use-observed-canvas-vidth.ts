import { useRef, useCallback } from 'react'

export function useObservedCanvasWidth(
  callback: (width: number) => void,
  min = 320
) {
  const observerRef = useRef<ResizeObserver | null>(null)

  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (node) {
        observerRef.current = new ResizeObserver(([entry]) => {
          const width = Math.max(Math.floor(entry.contentRect.width), min)
          console.log('Observed preview width =', width)

          callback(width)
        })
        observerRef.current.observe(node)
      }
    },
    [callback, min]
  )

  return containerRefCallback
}
