import React, { useRef, useState, useEffect } from 'react'
import styles from './color-palette.module.css'
import animStyles from '@/styles/animations.module.css'
import { ColorPopover } from './color-popover/color-popover'
import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'
import { vectorToHex } from '@/libs/cpc-palette'
import Icon from '../ui/icon'

export type ColorPaletteViewProps = {
  slots: PaletteSlot[]
  onToggleLock: (idx: number) => void
  onSetColor: (params: { index: number; color: CPCColor }) => void
  fullPalette: CPCColor[]
}

/**
 * Renders a color palette view with interactive color slots.
 *
 * Each slot can display a color (with lock/unlock functionality) or allow the user to add a new color from a popover palette.
 * Supports keyboard navigation and accessibility features for color selection.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Array<Slot>} props.slots - The current color slots in the palette.
 * @param {(index: number) => void} props.onToggleLock - Callback to toggle the lock state of a color slot.
 * @param {(params: { index: number; color: CPCColor }) => void} props.onSetColor - Callback to set a color for a slot.
 * @param {Array<CPCPaletteColor>} props.fullPalette - The full list of available colors to choose from.
 * @returns {JSX.Element} The rendered color palette view.
 */
export const ColorPaletteView: React.FC<ColorPaletteViewProps> = ({
  slots,
  onToggleLock,
  onSetColor,
  fullPalette
}) => {
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null)
  const [focusedColorIdx, setFocusedColorIdx] = useState<number>(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const colorOptionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Keep buttonRefs in sync with slots length to avoid stale refs
  useEffect(() => {
    buttonRefs.current.length = slots.length
  }, [slots.length])

  // Reset focused color index when popover opens/closes
  useEffect(() => {
    if (openPopoverIndex !== null) setFocusedColorIdx(0)
  }, [openPopoverIndex])

  // Imperatively focus the correct color option when focusedColorIdx changes
  useEffect(() => {
    const btn = colorOptionRefs.current[focusedColorIdx]
    if (btn) setTimeout(() => btn.focus(), 0)
  }, [focusedColorIdx, openPopoverIndex])

  // When opening the popover, set focusedColorIdx to the first enabled color
  useEffect(() => {
    if (openPopoverIndex !== null) {
      const firstEnabledIdx = fullPalette.findIndex((pc) => {
        return !slots.some((slot, i) => {
          if (i === openPopoverIndex) return false
          if (!slot.color) return false
          return Array.from(slot.color).every((v, j) => v === pc.vector[j])
        })
      })
      if (firstEnabledIdx !== -1) setFocusedColorIdx(firstEnabledIdx)
    }
  }, [openPopoverIndex, fullPalette, slots])

  const handleColorSelect = (color: CPCColor, idx: number) => {
    onSetColor({ index: idx, color })
    setOpenPopoverIndex(null)
  }

  const handlePopoverKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    optionsCount: number,
    slotIdx: number
  ) => {
    if (e.key === 'Escape') {
      setOpenPopoverIndex(null)
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      let nextIdx = focusedColorIdx
      do {
        nextIdx = (nextIdx + 1) % optionsCount
      } while (
        slots.some(
          (slot, i) =>
            i !== slotIdx &&
            slot.color &&
            Array.from(slot.color).every(
              (v, j) => v === fullPalette[nextIdx].vector[j]
            )
        ) &&
        nextIdx !== focusedColorIdx
      )
      setFocusedColorIdx(nextIdx)
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      let prevIdx = focusedColorIdx
      do {
        prevIdx = (prevIdx - 1 + optionsCount) % optionsCount
      } while (
        slots.some(
          (slot, i) =>
            i !== slotIdx &&
            slot.color &&
            Array.from(slot.color).every(
              (v, j) => v === fullPalette[prevIdx].vector[j]
            )
        ) &&
        prevIdx !== focusedColorIdx
      )
      setFocusedColorIdx(prevIdx)
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const color = fullPalette[focusedColorIdx]
      const isUsed = slots.some(
        (slot, i) =>
          i !== slotIdx &&
          slot.color &&
          Array.from(slot.color).every((v, j) => v === color.vector[j])
      )
      if (!isUsed) {
        handleColorSelect(color, slotIdx)
      }
    }
  }

  const POPOVER_BOTTOM_THRESHOLD = 200
  /**
   * Compute the popover position relative to the slot button.
   * @param {number} index - The slot index.
   * @returns {React.CSSProperties} The style object for popover positioning.
   */
  const getPopoverStyle = (index: number) => {
    const btn = buttonRefs.current[index]
    if (!btn) return {}
    const rect = btn.getBoundingClientRect()
    const isNearBottom =
      window.innerHeight - rect.bottom < POPOVER_BOTTOM_THRESHOLD
    return {
      top: isNearBottom ? 'auto' : `${rect.height + 5}px`,
      bottom: isNearBottom ? `${rect.height + 5}px` : 'auto',
      left: '50%',
      transform: 'translateX(-50%)'
    }
  }

  return (
    <div
      className={styles.container}
      role='region'
      aria-label='Palette de couleurs'
    >
      <div className={styles.paletteGrid}>
        {slots.map((slot, idx) => {
          const colorObj = slot.color
          const hex = colorObj ? vectorToHex(colorObj) : null
          return (
            <div
              key={idx}
              className={`${styles.colorSquare} ${animStyles.colorSquare}`}
            >
              {colorObj ? (
                <button
                  ref={(el) => {
                    buttonRefs.current[idx] = el
                  }}
                  className={styles.colorFill}
                  style={{ backgroundColor: `#${hex}` }}
                  aria-label={`#${hex} ${
                    slot.locked ? 'verrouillée' : 'déverrouillée'
                  }`}
                  aria-pressed={slot.locked}
                  title={`R:${colorObj[0]}, V:${colorObj[1]}, B:${colorObj[2]}`}
                  onClick={() => onToggleLock(idx)}
                >
                  {slot.locked && (
                    <span className={styles.lockOverlay} aria-hidden='true'>
                      <Icon name='LockClosedIcon' className={styles.lockIcon} />
                    </span>
                  )}
                </button>
              ) : (
                <div className={styles.emptySlotContainer}>
                  <button
                    ref={(el) => {
                      buttonRefs.current[idx] = el
                    }}
                    className={styles.emptySlot}
                    aria-label='Ajouter une couleur'
                    onClick={() => setOpenPopoverIndex(idx)}
                  >
                    <Icon name='PlusIcon' className={styles.plusIcon} />
                  </button>
                  {openPopoverIndex === idx && (
                    <ColorPopover
                      fullPalette={fullPalette}
                      slots={slots}
                      slotIdx={idx}
                      focusedColorIdx={focusedColorIdx}
                      onColorSelect={handleColorSelect}
                      onKeyDown={(e) =>
                        handlePopoverKeyDown(e, fullPalette.length, idx)
                      }
                      getPopoverStyle={getPopoverStyle}
                      onClose={() => setOpenPopoverIndex(null)}
                      colorOptionRefs={colorOptionRefs}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.helpText}>
        Cliquez sur une couleur pour la verrouiller/déverrouiller. Cliquez sur
        un emplacement vide pour ajouter une couleur.
      </div>
    </div>
  )
}
