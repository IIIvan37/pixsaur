import { useState, useRef, useEffect } from 'react'

import type { CPCColor } from '@/libs/types'

import styles from './color-palette.module.css'
import animStyles from '@/styles/animations.module.css'

import Icon from '../ui/icon'
import { PaletteSlot } from '@/app/store/palette/types'

/**
 * Props for the ColorPaletteView component.
 */
export type ColorPaletteViewProps = {
  /** The palette slots to display (filled or empty). */
  slots: PaletteSlot[]
  /** Handler to toggle lock state for a slot. */
  onToggleLock: (index: number) => void
  /** Handler to set a color for a slot. */
  onSetColor: ({ index, color }: { index: number; color: CPCColor }) => void
  /** The full list of available CPC colors. */
  fullPalette: CPCColor[]
}

// Threshold in pixels to determine if the popover should open upwards
const POPOVER_BOTTOM_THRESHOLD = 200

/**
 * Presentational component for displaying and interacting with the color palette.
 * Handles rendering of slots, lock/unlock, color selection popover, and accessibility.
 *
 * @param {ColorPaletteViewProps} props - The component props.
 * @returns {JSX.Element} The color palette UI.
 */

export const ColorPaletteView: React.FC<ColorPaletteViewProps> = ({
  slots,
  onToggleLock,
  onSetColor,
  fullPalette
}) => {
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null)
  const [focusedColorIdx, setFocusedColorIdx] = useState<number>(0)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Keep buttonRefs in sync with slots length to avoid stale refs
  useEffect(() => {
    buttonRefs.current.length = slots.length
  }, [slots.length])

  // Close the popover when clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setOpenPopoverIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Reset focused color index when popover opens/closes
  useEffect(() => {
    if (openPopoverIndex !== null) setFocusedColorIdx(0)
  }, [openPopoverIndex])

  /**
   * Keyboard navigation for the color popover.
   */
  const handlePopoverKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    optionsCount: number,
    slotIdx: number
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusedColorIdx((prev) => (prev + 1) % optionsCount)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusedColorIdx((prev) => (prev - 1 + optionsCount) % optionsCount)
    } else if (e.key === 'Escape') {
      setOpenPopoverIndex(null)
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Simulate click on the focused color if not disabled
      const pc = fullPalette[focusedColorIdx]
      const isUsed = slots.some((s, i) => {
        if (i === slotIdx) return false
        return (
          Array.from(s.color ?? []).every((v, j) => v === pc.vector[j]) ?? false
        )
      })
      if (!isUsed) {
        onSetColor({ index: slotIdx, color: pc })
        setOpenPopoverIndex(null)
      }
    }
  }

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

  const handleColorSelect = (paletteColor: CPCColor, slotIndex: number) => {
    onSetColor({ index: slotIndex, color: paletteColor })
    setOpenPopoverIndex(null)
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
            ? fullPalette.find((c) =>
                Array.from(c.vector).every(
                  (v, i) => v === Array.from(slot.color!)[i]
                )
              ) || null
            : null

          return (
            <div
              key={idx}
              className={`${styles.colorSquare} ${animStyles.colorSquare}`}
            >
              {colorObj ? (
                <button
                  className={styles.colorFill}
                  style={{ backgroundColor: `#${colorObj.hex}` }}
                  title={`${colorObj.name} : R:${colorObj.vector[0]}, V:${colorObj.vector[1]}, B:${colorObj.vector[2]}`}
                  onClick={() => onToggleLock(idx)}
                  aria-label={`${colorObj.name} ${
                    slot.locked ? 'verrouillée' : 'déverrouillée'
                  }`}
                  aria-pressed={slot.locked}
                >
                  {slot.locked && (
                    <div className={styles.lockOverlay} aria-hidden='true'>
                      <Icon name='LockClosedIcon' className={styles.lockIcon} />
                    </div>
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
                    onClick={() =>
                      setOpenPopoverIndex((prev) => (prev === idx ? null : idx))
                    }
                  >
                    <Icon name='PlusIcon' className={styles.plusIcon} />
                  </button>

                  {openPopoverIndex === idx && (
                    <div
                      className={styles.colorPopover}
                      ref={popoverRef}
                      style={getPopoverStyle(idx)}
                      tabIndex={-1}
                      onKeyDown={(e) =>
                        handlePopoverKeyDown(e, fullPalette.length, idx)
                      }
                    >
                      <div
                        className={styles.colorGrid}
                        role='listbox'
                        aria-label='Options de couleur'
                      >
                        {fullPalette.map((pc, optionIdx) => {
                          const isUsed = slots.some((s, i) => {
                            if (i === idx) return false
                            return (
                              Array.from(s.color ?? []).every(
                                (v, j) => v === pc.vector[j]
                              ) ?? false
                            )
                          })
                          return (
                            <button
                              key={pc.index}
                              className={`${styles.colorOption} ${
                                animStyles.colorSquare
                              } ${isUsed ? styles.colorOptionActive : ''}`}
                              style={{ backgroundColor: `#${pc.hex}` }}
                              title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
                              role='option'
                              aria-selected={isUsed}
                              disabled={isUsed}
                              tabIndex={focusedColorIdx === optionIdx ? 0 : -1}
                              autoFocus={focusedColorIdx === optionIdx}
                              onClick={() => handleColorSelect(pc, idx)}
                            />
                          )
                        })}
                      </div>
                    </div>
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
