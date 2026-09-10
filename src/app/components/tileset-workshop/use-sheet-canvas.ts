import { useEffect, useState } from 'react'
import type { Sheet } from '@/libs/pixsaur-tileset'

/**
 * Draws a sheet on a canvas, as the image workshop does — no encoding is
 * needed to look at pixels (Q20).
 *
 * Hands back a callback ref rather than a ref object: a canvas inside a tab
 * is unmounted while the tab is hidden, and the one mounted on its return
 * must be drawn even though the sheet has not changed.
 */
export function useSheetCanvas(sheet: Sheet | null) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvas || !sheet) return

    canvas.width = sheet.width
    canvas.height = sheet.height
    canvas
      .getContext('2d')
      ?.putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0)
  }, [canvas, sheet])

  return setCanvas
}
