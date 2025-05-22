import React, { useRef, useState, useEffect } from 'react'
import styles from './color-palette.module.css'
import animStyles from '@/styles/animations.module.css'
import { ColorPopover } from './color-popover/color-popover'
import { PaletteSlot } from '@/app/store/palette/types'
import { CPCColor } from '@/libs/types'
import { vectorToHex } from '@/libs/cpc-palette'
import Icon from '../ui/icon'
import PixsaurPopover from '../ui/popover'

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
                <PixsaurPopover
                  open={openPopoverIndex === idx}
                  onOpenChange={(v) => setOpenPopoverIndex(v ? idx : null)}
                  trigger={
                    <button
                      ref={(el) => {
                        buttonRefs.current[idx] = el
                      }}
                      className={styles.emptySlot}
                      aria-label='Ajouter une couleur'
                    >
                      <Icon name='PlusIcon' className={styles.plusIcon} />
                    </button>
                  }
                >
                  <ColorPopover
                    fullPalette={fullPalette}
                    slots={slots}
                    slotIdx={idx}
                    focusedColorIdx={focusedColorIdx}
                    onColorSelect={handleColorSelect}
                 
                    colorOptionRefs={colorOptionRefs}
                  />
                </PixsaurPopover>
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
