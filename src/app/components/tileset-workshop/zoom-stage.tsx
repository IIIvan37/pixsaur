import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import {
  type MouseEventHandler,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { localeAtom } from '@/app/store/locale'
import { tilesetStageZoomAtom } from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import type { Sheet } from '@/libs/pixsaur-tileset'
import { anchorScroll, fitZoom, type Size, zoomIn, zoomOut } from './stage-zoom'
import styles from './tileset-workshop.module.css'

/** How far an arrow key moves the view, in screen pixels. */
const ARROW_STEP = 48

/** Which way each arrow key moves the view: [x, y]. */
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/** How far the mouse travels before a press becomes a drag, not a click. */
const DRAG_THRESHOLD = 3

type Point = { x: number; y: number }

type ZoomStageProps = {
  image: Sheet
  label: string
  /** Layers drawn over the image, at its size on screen. */
  children?: ReactNode
  onMouseMove?: MouseEventHandler<HTMLCanvasElement>
  onMouseLeave?: MouseEventHandler<HTMLCanvasElement>
  onClick?: MouseEventHandler<HTMLCanvasElement>
}

/**
 * The stage's one view of an image (S-Q12): the map, the sheet or the atlas,
 * zoomed and moved about (S-Q13 · S-Q14).
 *
 * The image is put once on a native canvas kept in memory, then copied at the
 * zoom with smoothing off: a CPC pixel stays a sharp block at every factor.
 * The page scrolls the copy, so the browser keeps the scrollbars, the touch
 * gestures and the bounds; the stage only moves the scroll.
 *
 * The image already carries the CPC pixel's shape (`stretchOf(mode)`): the
 * stage zooms both axes alike, and never stretches it a second time.
 */
export function ZoomStage({
  image,
  label,
  children,
  onMouseMove,
  onMouseLeave,
  onClick
}: ZoomStageProps) {
  const { _ } = useLingui()
  const locale = useAtomValue(localeAtom)
  const [chosen, setChosen] = useAtom(tilesetStageZoomAtom)
  const viewport = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const size = useViewportSize(viewport)

  const native = useMemo(() => nativeCanvasOf(image), [image])
  const fit = fitZoom(image, size)
  const zoom = chosen === 'fit' ? fit : chosen
  const width = Math.round(image.width * zoom)
  const height = Math.round(image.height * zoom)

  // The point of the stage to hold still through the next zoom: the pointer
  // for the wheel, the stage's centre otherwise.
  const anchor = useRef<Point | null>(null)
  const shown = useRef(zoom)

  const zoomTo = (next: number | 'fit', at: Point | null = null) => {
    anchor.current = at
    setChosen(next)
  }
  const zoomInFrom = (at?: Point) => zoomTo(zoomIn(zoom, image), at)
  const zoomOutFrom = (at?: Point) => zoomTo(zoomOut(zoom, fit), at)

  useLayoutEffect(() => {
    const target = canvas.current
    if (!target) return
    target.width = width
    target.height = height
    const context = target.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    context.drawImage(native, 0, 0, width, height)
  }, [native, width, height])

  // After the copy above, so the stage scrolls a canvas already resized.
  useLayoutEffect(() => {
    const from = shown.current
    shown.current = zoom
    const stage = viewport.current
    if (!stage || from === zoom) return

    const at = anchor.current ?? {
      x: stage.clientWidth / 2,
      y: stage.clientHeight / 2
    }
    anchor.current = null
    stage.scrollLeft = anchorScroll({
      scroll: stage.scrollLeft,
      pointer: at.x,
      viewport: stage.clientWidth,
      length: image.width,
      from,
      to: zoom
    })
    stage.scrollTop = anchorScroll({
      scroll: stage.scrollTop,
      pointer: at.y,
      viewport: stage.clientHeight,
      length: image.height,
      from,
      to: zoom
    })
  }, [zoom, image])

  useCtrlWheel(viewport, (at, up) => (up ? zoomInFrom(at) : zoomOutFrom(at)))
  const drag = useDragToScroll(viewport)

  const handleKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const arrow = ARROWS[event.key]
    const zooms: Record<string, () => void> = {
      '+': () => zoomInFrom(),
      '=': () => zoomInFrom(),
      '-': () => zoomOutFrom(),
      '0': () => zoomTo('fit')
    }
    const zoomKey = zooms[event.key]
    if (!arrow && !zoomKey) return
    event.preventDefault()
    if (arrow) {
      event.currentTarget.scrollBy({
        left: arrow[0] * ARROW_STEP,
        top: arrow[1] * ARROW_STEP
      })
    } else {
      zoomKey()
    }
  }

  // The factor stays outside the message: the Lingui macro drops the values
  // of an interpolated one.
  const numbers = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale]
  )
  const factor = `${numbers.format(zoom)}×`

  return (
    <div className={styles.zoomStage}>
      <fieldset aria-label={_(msg`Zoom`)} className={styles.zoomBar}>
        <Button
          variant='secondary'
          aria-label={_(msg`Zoom arrière`)}
          disabled={zoomOut(zoom, fit) === zoom}
          onClick={() => zoomOutFrom()}
        >
          −
        </Button>
        <Button
          variant='secondary'
          aria-pressed={chosen === 'fit'}
          onClick={() => zoomTo('fit')}
        >
          <Trans>Ajuster</Trans>
        </Button>
        <Button
          variant='secondary'
          aria-label={_(msg`Zoom avant`)}
          disabled={zoomIn(zoom, image) === zoom}
          onClick={() => zoomInFrom()}
        >
          +
        </Button>
        <output aria-label={_(msg`Facteur de zoom`)}>{factor}</output>
      </fieldset>

      <section
        ref={viewport}
        aria-label={_(msg`Image zoomable`)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the keys of S-Q14 zoom and move a region that takes the focus, as any scrolling region does.
        tabIndex={0}
        className={styles.zoomViewport}
        data-dragging={drag.dragging || undefined}
        onKeyDown={handleKey}
        {...drag.handlers}
      >
        <div className={styles.zoomContent}>
          <div className={styles.zoomFrame} style={{ width, height }}>
            <canvas
              ref={canvas}
              role='img'
              aria-label={label}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
            />
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}

/** The image at its own size, put once: every zoom copies from it. */
function nativeCanvasOf(image: Sheet): HTMLCanvasElement {
  const native = document.createElement('canvas')
  native.width = image.width
  native.height = image.height
  native
    .getContext('2d')
    ?.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  return native
}

/** The stage's inner size, kept up to date as the window moves. */
function useViewportSize(viewport: React.RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const stage = viewport.current
    if (!stage) return
    const measure = () =>
      setSize((was) =>
        was.width === stage.clientWidth && was.height === stage.clientHeight
          ? was
          : { width: stage.clientWidth, height: stage.clientHeight }
      )
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [viewport])

  return size
}

/**
 * Ctrl + wheel zooms about the pointer (S-Q13). A native listener, not
 * React's `onWheel`: React listens passively, and only an active listener
 * keeps the browser from zooming the whole page instead.
 */
function useCtrlWheel(
  viewport: React.RefObject<HTMLElement | null>,
  onZoom: (at: Point, up: boolean) => void
) {
  const latest = useRef(onZoom)
  latest.current = onZoom

  useEffect(() => {
    const stage = viewport.current
    if (!stage) return
    const handle = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()
      // From the inside of the border, where the scrolled content starts.
      const box = stage.getBoundingClientRect()
      latest.current(
        {
          x: event.clientX - box.left - stage.clientLeft,
          y: event.clientY - box.top - stage.clientTop
        },
        event.deltaY < 0
      )
    }
    stage.addEventListener('wheel', handle, { passive: false })
    return () => stage.removeEventListener('wheel', handle)
  }, [viewport])
}

/**
 * A mouse drag moves the view (S-Q13). Touch already scrolls on its own.
 *
 * A press that barely moves stays a click, for the views that pick a cell.
 * A real drag swallows the click that ends it.
 */
function useDragToScroll(viewport: React.RefObject<HTMLElement | null>) {
  const start = useRef<{ x: number; y: number; left: number; top: number }>(
    null
  )
  const [dragging, setDragging] = useState(false)

  const handlers = {
    onPointerDown: (event: React.PointerEvent) => {
      const stage = viewport.current
      if (!stage || event.pointerType !== 'mouse' || event.button !== 0) return
      start.current = {
        x: event.clientX,
        y: event.clientY,
        left: stage.scrollLeft,
        top: stage.scrollTop
      }
    },
    onPointerMove: (event: React.PointerEvent) => {
      const stage = viewport.current
      const from = start.current
      if (!stage || !from) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (!dragging && Math.abs(dx) + Math.abs(dy) <= DRAG_THRESHOLD) return
      if (!dragging) {
        setDragging(true)
        stage.setPointerCapture(event.pointerId)
      }
      stage.scrollLeft = from.left - dx
      stage.scrollTop = from.top - dy
    },
    onPointerUp: () => {
      start.current = null
    },
    onPointerCancel: () => {
      start.current = null
      setDragging(false)
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (!dragging) return
      event.stopPropagation()
      setDragging(false)
    }
  }

  return { dragging, handlers }
}
