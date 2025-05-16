'use client'

import type React from 'react'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import styles from '@/styles/ui/popover.module.css'

type PopoverPosition = 'top' | 'bottom' | 'left' | 'right'

interface PopoverProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement>
  position?: PopoverPosition
  className?: string
}

export default function Popover({
  children,
  isOpen,
  onClose,
  triggerRef,
  position = 'bottom',
  className = ''
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const [actualPosition, setActualPosition] =
    useState<PopoverPosition>(position)

  useEffect(() => {
    if (isOpen && triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()

      // Calculer la position initiale en fonction de la position demandée
      let style: React.CSSProperties = {}
      let newPosition = position

      // Vérifier si le popover dépasse de l'écran
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const margin = 10 // Marge de sécurité

      switch (position) {
        case 'top':
          // Positionner au-dessus du trigger
          style = {
            position: 'fixed',
            left:
              triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2,
            bottom: viewportHeight - triggerRect.top + 8
          }

          // Si le popover dépasse en haut
          if (triggerRect.top - popoverRect.height - 8 < margin) {
            // Basculer vers le bas
            style.bottom = undefined
            style.top = triggerRect.bottom + 8
            newPosition = 'bottom'
          }
          break

        case 'bottom':
          // Positionner en dessous du trigger
          style = {
            position: 'fixed',
            left:
              triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2,
            top: triggerRect.bottom + 8
          }

          // Si le popover dépasse en bas
          if (
            triggerRect.bottom + popoverRect.height + 8 >
            viewportHeight - margin
          ) {
            // Basculer vers le haut
            style.top = undefined
            style.bottom = viewportHeight - triggerRect.top + 8
            newPosition = 'top'
          }
          break

        case 'left':
          style = {
            position: 'fixed',
            right: viewportWidth - triggerRect.left + 8,
            top:
              triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
          }

          // Si le popover dépasse à gauche
          if (triggerRect.left - popoverRect.width - 8 < margin) {
            // Basculer vers la droite
            style.right = undefined
            style.left = triggerRect.right + 8
            newPosition = 'right'
          }
          break

        case 'right':
          style = {
            position: 'fixed',
            left: triggerRect.right + 8,
            top:
              triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
          }

          // Si le popover dépasse à droite
          if (
            triggerRect.right + popoverRect.width + 8 >
            viewportWidth - margin
          ) {
            // Basculer vers la gauche
            style.left = undefined
            style.right = viewportWidth - triggerRect.left + 8
            newPosition = 'left'
          }
          break
      }

      // Ajustements horizontaux pour top et bottom
      if (newPosition === 'top' || newPosition === 'bottom') {
        // Si le popover dépasse à gauche
        if ((style.left as number) < margin) {
          style.left = margin
        }

        // Si le popover dépasse à droite
        if (
          (style.left as number) + popoverRect.width >
          viewportWidth - margin
        ) {
          style.left = viewportWidth - popoverRect.width - margin
        }
      }

      // Ajustements verticaux pour left et right
      if (newPosition === 'left' || newPosition === 'right') {
        // Si le popover dépasse en haut
        if ((style.top as number) < margin) {
          style.top = margin
        }

        // Si le popover dépasse en bas
        if (
          (style.top as number) + popoverRect.height >
          viewportHeight - margin
        ) {
          style.top = viewportHeight - popoverRect.height - margin
        }
      }

      setActualPosition(newPosition)
      setPopoverStyle(style)
    }
  }, [isOpen, position, triggerRef])

  // Fermer le popover quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        ref={popoverRef}
        className={`${styles.popover} ${
          styles[
            `popover${
              actualPosition.charAt(0).toUpperCase() + actualPosition.slice(1)
            }`
          ]
        } ${className}`}
        style={popoverStyle}
        role='dialog'
      >
        {children}
      </div>
    </>
  )
}
