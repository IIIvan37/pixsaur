import React, { useRef, useState, useEffect } from 'react'
import styles from './color-palette.module.css'
import animStyles from '@/styles/animations.module.css'

import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'

import { ColorSlot } from './color-slot/color-slot'
import { EmptySlotButton } from './color-slot/empty.slot'

export type ColorPaletteViewProps = {
  slots: PaletteSlot[]
  onToggleLock: (idx: number) => void
  onSetColor: (params: { index: number; color: CPCColor }) => void
  fullPalette: CPCColor[]
}

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

  useEffect(() => {
    buttonRefs.current.length = slots.length
  }, [slots.length])

  useEffect(() => {
    if (openPopoverIndex !== null) setFocusedColorIdx(0)
  }, [openPopoverIndex])

  useEffect(() => {
    const btn = colorOptionRefs.current[focusedColorIdx]
    if (btn) setTimeout(() => btn.focus(), 0)
  }, [focusedColorIdx, openPopoverIndex])

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

  return (
    <div
      className={styles.container}
      role='region'
      aria-label='Palette de couleurs'
    >
      <div className={styles.paletteGrid}>
        {slots.map((slot, idx) => {
          const color = slot.color

          return (
            <div
              key={idx}
              className={`${styles.colorSquare} ${animStyles.colorSquare}`}
            >
              {color ? (
                <ColorSlot
                  idx={idx}
                  color={color}
                  locked={slot.locked}
                  buttonRef={(el) => {
                    buttonRefs.current[idx] = el
                  }}
                  onToggleLock={onToggleLock}
                />
              ) : (
                <EmptySlotButton
                  idx={idx}
                  buttonRef={(el) => {
                    buttonRefs.current[idx] = el
                  }}
                  open={openPopoverIndex === idx}
                  onOpenChange={(v) => setOpenPopoverIndex(v ? idx : null)}
                  slots={slots}
                  fullPalette={fullPalette}
                  focusedColorIdx={focusedColorIdx}
                  onColorSelect={handleColorSelect}
                  colorOptionRefs={colorOptionRefs}
                />
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
