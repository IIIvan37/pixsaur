import { setCanvasWidth } from '@/app/store/image/image'
import { useSetAtom } from 'jotai'
import { useRef, useCallback } from 'react'

export function useObservedCanvasWidth(min = 320) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const setWidth = useSetAtom(setCanvasWidth)

  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      console.log('HERE')
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (node) {
        console.log('Observing node:', node)
        observerRef.current = new ResizeObserver(([entry]) => {
          const width = Math.max(Math.floor(entry.contentRect.width), min)
          console.log('Observed width:', width)
          setWidth(width)
        })
        observerRef.current.observe(node)
      }
    },
    [setWidth, min]
  )

  return containerRefCallback
}
