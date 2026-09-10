// ColorPaletteView: Main palette UI component
// Handles popover logic, slot mapping, focus management, and accessibility

import { useEffect, useRef, useState } from 'react'
import type { PaletteSlot } from '@/app/store/palette/types'
import { ColorPickerPopup } from '@/components/ui/color-picker-popup'
import PixsaurPopover from '@/components/ui/popover'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCColor, CPCHardware } from '@/libs/types'
import animStyles from '@/styles/animations.module.css'
import { ColorGridView } from './color-grid/color-grid-view'
import styles from './color-palette.module.css'
import { ColorSlot } from './color-slot/color-slot'
import { EmptySlotButton } from './color-slot/empty.slot'

/**
 * Helper function to convert Vector to CPCColor for CPC Plus mode
 */
function vectorToCPCColor(vector: Vector, index: number): CPCColor {
  const [r, g, b] = vector
  return {
    index,
    name: `RGB(${r},${g},${b})`,
    hex: `${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
    vector
  }
}

/**
 * Props for ColorPaletteView
 * @property slots - Array of palette slots
 * @property onToggleLock - Callback to toggle lock state for a slot
 * @property onSetColor - Callback to set color for a slot
 * @property onClearSlot - Callback to clear a slot and lock it. Omit where a
 *   slot is never empty; the button is then not offered.
 * @property fullPalette - Array of all available colors
 * @property hardware - Which CPC picks the colours: the classic 27-colour grid
 *   or the Plus RGB sliders. A prop, not an atom, so a second workshop can pass
 *   its own machine rather than the image workshop's.
 */
export type ColorPaletteViewProps = {
  readonly slots: PaletteSlot[]
  readonly onToggleLock: (idx: number) => void
  readonly onSetColor: (params: { index: number; color: CPCColor }) => void
  readonly onClearSlot?: (idx: number) => void
  readonly fullPalette: CPCColor[]
  readonly hardware: CPCHardware
  readonly label?: string
}

export const ColorPaletteView = ({
  slots,
  onToggleLock,
  onSetColor,
  onClearSlot,
  fullPalette,
  hardware,
  label = 'Palette de couleurs'
}: ColorPaletteViewProps) => {
  // openPopoverIndex: index of slot with open popover, or null
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null)
  // focusedColorIdx: index of focused color option in popover
  const [focusedColorIdx, setFocusedColorIdx] = useState<number>(0)
  // buttonRefs: refs for slot buttons
  const buttonRefs = useRef<HTMLButtonElement[]>([])
  // colorOptionRefs: refs for color option buttons in popover
  const colorOptionRefs = useRef<HTMLButtonElement[]>([])

  const isClassicMode = hardware === 'classic'

  // Ensure buttonRefs array matches slots length
  useEffect(() => {
    buttonRefs.current.length = slots.length
  }, [slots.length])

  // Reset focused color when popover opens
  useEffect(() => {
    if (openPopoverIndex !== null) setFocusedColorIdx(0)
  }, [openPopoverIndex])

  // Focus the color option button when focusedColorIdx changes.
  // Deferred to the next tick so the popover has mounted; cleared on unmount so
  // the timer cannot fire against a detached button.
  useEffect(() => {
    const btn = colorOptionRefs.current[focusedColorIdx]
    if (!btn) return

    const timer = setTimeout(() => btn.focus(), 0)
    return () => clearTimeout(timer)
  }, [focusedColorIdx])

  // When popover opens, focus the first color option
  useEffect(() => {
    if (openPopoverIndex !== null) {
      setFocusedColorIdx(0)
    }
  }, [openPopoverIndex])

  /**
   * Handles color selection for a slot
   * @param color - Selected color
   * @param idx - Slot index
   */
  const handleColorSelect = (color: CPCColor, idx: number) => {
    onSetColor({ index: idx, color })
    setOpenPopoverIndex(null)
  }

  /**
   * Handles RGB color selection for CPC Plus mode
   * @param vector - RGB vector [r, g, b]
   * @param idx - Slot index
   */
  const handleRgbColorSelect = (vector: Vector, idx: number) => {
    const color = vectorToCPCColor(vector, idx)
    onSetColor({ index: idx, color })
    setOpenPopoverIndex(null)
  }

  return (
    <section className={styles.container} aria-label={label}>
      <div className={styles.paletteGrid}>
        {slots.map((slot, idx) => {
          const isPopoverOpen = openPopoverIndex === idx
          return (
            <div
              key={`slot-${idx}-${slot.color || 'empty'}`}
              className={`${styles.colorSquare} ${animStyles.colorSquare}`}
              style={{ position: 'relative' }}
            >
              {slot.color ? (
                <PixsaurPopover
                  open={isPopoverOpen}
                  onOpenChange={(open) =>
                    setOpenPopoverIndex(open ? idx : null)
                  }
                  variant={isClassicMode ? 'default' : 'unstyled'}
                  trigger={
                    <ColorSlot
                      color={slot.color}
                      locked={slot.locked}
                      buttonRef={(el) => {
                        if (el) buttonRefs.current[idx] = el
                      }}
                      onOpenPopover={() => {
                        setOpenPopoverIndex(idx)
                      }}
                      focused={openPopoverIndex === idx}
                    />
                  }
                >
                  {isClassicMode ? (
                    <ColorGridView
                      fullPalette={fullPalette}
                      slots={slots}
                      slotIndex={idx}
                      focusedColorIndex={focusedColorIdx}
                      onColorSelect={(color) => handleColorSelect(color, idx)}
                      colorOptionRefs={colorOptionRefs}
                      optionRefs={colorOptionRefs}
                      onToggleLock={onToggleLock}
                      onClearSlot={onClearSlot}
                      onClose={() => setOpenPopoverIndex(null)}
                    />
                  ) : (
                    <ColorPickerPopup
                      initialColor={slot.color}
                      isLocked={slot.locked}
                      onColorConfirm={(vector) =>
                        handleRgbColorSelect(vector, idx)
                      }
                      onToggleLock={() => onToggleLock(idx)}
                      onClearSlot={
                        onClearSlot &&
                        (() => {
                          onClearSlot(idx)
                          setOpenPopoverIndex(null)
                        })
                      }
                      onClose={() => setOpenPopoverIndex(null)}
                    />
                  )}
                </PixsaurPopover>
              ) : (
                <EmptySlotButton
                  idx={idx}
                  buttonRef={(el) => {
                    if (el) buttonRefs.current[idx] = el
                  }}
                  open={isPopoverOpen}
                  onOpenChange={(open) => {
                    // Removed debug log
                    setOpenPopoverIndex(open ? idx : null)
                  }}
                  slots={slots}
                  fullPalette={fullPalette}
                  focusedColorIdx={focusedColorIdx}
                  onColorSelect={handleColorSelect}
                  onRgbColorSelect={handleRgbColorSelect}
                  colorOptionRefs={colorOptionRefs}
                  locked={slot.locked}
                  onToggleLock={onToggleLock}
                  hardware={hardware}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
