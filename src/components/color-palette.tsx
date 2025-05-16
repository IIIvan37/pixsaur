import { useState, useRef, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { getCPCPalette } from '@/libs/cpc-palette'

import type { CPCColor } from '@/libs/types'

import styles from '../styles/color-palette.module.css'
import animStyles from '../styles/animations.module.css'
import Icon from './ui/icon'
import {
  userPaletteAtom,
  onToggleLockAtom,
  onSetColorAtom
} from '@/app/store/palette/palette'

export function ColorPalette() {
  // Lecture de la palette fusionnée (reduced + locked)
  const slots = useAtomValue(userPaletteAtom)
  const toggleLock = useSetAtom(onToggleLockAtom)
  const setColor = useSetAtom(onSetColorAtom)

  // Palette complète CPC pour lookup
  const fullPalette = getCPCPalette()

  // État du popover
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Fermer le popover quand on clique à l'extérieur
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

  // Calcul de la position du popover
  const getPopoverStyle = (index: number) => {
    const btn = buttonRefs.current[index]
    if (!btn) return {}
    const rect = btn.getBoundingClientRect()
    const isNearBottom = window.innerHeight - rect.bottom < 200
    return {
      top: isNearBottom ? 'auto' : `${rect.height + 5}px`,
      bottom: isNearBottom ? `${rect.height + 5}px` : 'auto',
      left: '50%',
      transform: 'translateX(-50%)'
    }
  }

  // Au clic sur une couleur dans le popover
  const handleColorSelect = (paletteColor: CPCColor, slotIndex: number) => {
    setColor({ index: slotIndex, color: paletteColor })
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
          // Retrouver l'objet CPCColor pour affichage
          const colorObj = slot.color
            ? fullPalette.find((c) =>
                c.vector.every((v, i) => v === slot.color![i])
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
                  title={`${colorObj.name}: R:${colorObj.vector[0]}, G:${colorObj.vector[1]}, B:${colorObj.vector[2]}`}
                  onClick={() => toggleLock(idx)}
                  aria-label={`${colorObj.name} ${
                    slot.locked ? 'verrouillé' : 'déverrouillé'
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
                    >
                      <div
                        className={styles.colorGrid}
                        role='listbox'
                        aria-label='Options de couleurs'
                      >
                        {fullPalette.map((pc) => {
                          // Désactiver si déjà utilisée sur un autre slot
                          const isUsed = slots.some((s, i) => {
                            if (i === idx) return false
                            return (
                              s.color?.every((v, j) => v === pc.vector[j]) ??
                              false
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
