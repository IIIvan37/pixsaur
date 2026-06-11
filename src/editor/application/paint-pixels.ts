/**
 * Use-case: paint one or more pixels in the editor buffer.
 *
 * Pure, synchronous, total. Replaces the orchestration inlined in
 * `paintPixelAtom` / `paintPixelsAtom` (`app/store/editor/editor-actions.ts`):
 * both a single click (with EGX low-res pixel-group expansion) and a drag
 * stroke go through this one function. The Jotai atoms are thin adapters that
 * read state, inject the `Clock` port, and write the result back.
 */

import type { EGXConfig } from '@/libs/pixsaur-egx'
import { getMaxColorIndex, getModeForLine } from '@/libs/pixsaur-egx'
import type { Clock } from './ports'
import {
  type EditHistoryEntry,
  MAX_HISTORY_SIZE,
  type PixelEdit
} from './types'

export interface Point {
  x: number
  y: number
}

export interface PaintPixelsInput {
  /** Current editor index buffer (read-only — never mutated by the use-case). */
  buffer: Uint8Array
  width: number
  height: number
  /** Ink index to paint. */
  selectedInk: number
  /**
   * EGX config when EGX mode is active, else `null` (no per-line constraint and
   * no low-res grouping).
   */
  egxConfig: EGXConfig | null
  /** Target pixels — a single click, or a drag stroke. */
  pixels: Point[]
  /** History entry kind: `'pixel'` for a single click, `'region'` for a drag. */
  entryType: EditHistoryEntry['type']
  /**
   * Expand each target to its 2-wide CPC pixel group on EGX low-res lines
   * (single click). Drag strokes paint raw pixels (`false`).
   */
  expandLowResGroups: boolean
  history: EditHistoryEntry[]
  historyIndex: number
}

export interface PaintPixelsDeps {
  clock: Clock
}

export interface PaintPixelsResult {
  /** Whether any pixel actually changed. */
  changed: boolean
  /**
   * New buffer copy with edits applied when `changed`; the original `buffer`
   * (untouched) otherwise.
   */
  buffer: Uint8Array
  edits: PixelEdit[]
  history: EditHistoryEntry[]
  historyIndex: number
}

/**
 * Expand a target to the pixels it actually paints. On an EGX low-res line the
 * buffer is at high-res resolution, so one logical pixel spans a 2-wide group;
 * x is aligned to the even boundary and the right neighbour is added when in
 * bounds. High-res lines (and non-EGX) paint the single pixel as-is.
 */
function expandToGroup(
  p: Point,
  egxConfig: EGXConfig | null,
  width: number
): Point[] {
  if (!egxConfig) return [p]

  const lineMode = getModeForLine(p.y, egxConfig)
  const highResMode = egxConfig.type === 'egx1' ? 1 : 2
  if (lineMode === highResMode) return [p]

  const alignedX = p.x - (p.x % 2)
  const group: Point[] = [{ x: alignedX, y: p.y }]
  if (alignedX + 1 < width) group.push({ x: alignedX + 1, y: p.y })
  return group
}

/**
 * EGX constrains how many colors a line can show. Painting an ink beyond the
 * line's limit is silently skipped.
 */
function exceedsInkLimit(
  y: number,
  selectedInk: number,
  egxConfig: EGXConfig | null
): boolean {
  if (!egxConfig) return false
  const lineMode = getModeForLine(y, egxConfig)
  return selectedInk > getMaxColorIndex(lineMode, egxConfig.type)
}

/**
 * Truncate any redone-then-overwritten future, append the new entry, and cap
 * the history to `MAX_HISTORY_SIZE` (dropping the oldest entry).
 */
function pushHistory(
  history: EditHistoryEntry[],
  historyIndex: number,
  entry: EditHistoryEntry
): { history: EditHistoryEntry[]; historyIndex: number } {
  const next = [...history.slice(0, historyIndex + 1), entry]
  if (next.length > MAX_HISTORY_SIZE) next.shift()
  return { history: next, historyIndex: next.length - 1 }
}

export function paintPixels(
  input: PaintPixelsInput,
  deps: PaintPixelsDeps
): PaintPixelsResult {
  const {
    buffer,
    width,
    height,
    selectedInk,
    egxConfig,
    pixels,
    entryType,
    expandLowResGroups,
    history,
    historyIndex
  } = input

  const next = new Uint8Array(buffer)
  const edits: PixelEdit[] = []

  for (const p of pixels) {
    const targets = expandLowResGroups
      ? expandToGroup(p, egxConfig, width)
      : [p]

    for (const t of targets) {
      if (t.x < 0 || t.x >= width || t.y < 0 || t.y >= height) continue
      if (exceedsInkLimit(t.y, selectedInk, egxConfig)) continue

      const offset = t.y * width + t.x
      const previousInk = next[offset]
      if (previousInk === selectedInk) continue

      next[offset] = selectedInk
      edits.push({
        x: t.x,
        y: t.y,
        previousInkIndex: previousInk,
        newInkIndex: selectedInk
      })
    }
  }

  if (edits.length === 0) {
    return { changed: false, buffer, edits: [], history, historyIndex }
  }

  const entry: EditHistoryEntry = {
    type: entryType,
    edits,
    timestamp: deps.clock.now()
  }
  const pushed = pushHistory(history, historyIndex, entry)

  return {
    changed: true,
    buffer: next,
    edits,
    history: pushed.history,
    historyIndex: pushed.historyIndex
  }
}
