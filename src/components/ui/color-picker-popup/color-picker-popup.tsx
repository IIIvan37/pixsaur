import { useState } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import Button from '../button'
import Flex from '../flex'
import { RgbSlider } from '../rgb-slider'
import styles from './color-picker-popup.module.css'

export interface ColorPickerPopupProps {
  /** Couleur initiale */
  readonly initialColor: Vector
  /** Indique si la couleur est verrouillée */
  readonly isLocked: boolean
  /** Callback appelé lors de la validation d'une nouvelle couleur */
  readonly onColorConfirm: (color: Vector) => void
  /** Callback pour basculer le verrouillage */
  readonly onToggleLock: () => void
  /** Callback pour fermer la popup */
  readonly onClose: () => void
  /** Masquer le bouton de verrouillage (pour les empty slots) */
  readonly hideLockButton?: boolean
}

/**
 * Popup avancée de sélection de couleur avec sliders RGB
 * 
 * Fonctionnalités :
 * - Sliders RGB pour ajustement précis
 * - Bouton de validation pour confirmer les changements
 * - Système de verrouillage/déverrouillage intégré
 * - La popup reste ouverte pendant les ajustements
 */
export function ColorPickerPopup({
  initialColor,
  isLocked,
  onColorConfirm,
  onToggleLock,
  onClose,
  hideLockButton = false
}: ColorPickerPopupProps) {
  // État local pour la couleur en cours d'édition
  const [workingColor, setWorkingColor] = useState<Vector>(initialColor)

  const handleConfirm = () => {
    onColorConfirm(workingColor)
    onClose()
  }

  const handleCancel = () => {
    // Restaurer la couleur initiale
    setWorkingColor(initialColor)
    onClose()
  }

  const handleToggleLock = () => {
    onToggleLock()
    onClose() // Fermer la popup après toggle, comme dans la popup classique
  }

  const [r, g, b] = workingColor

  return (
    <div className={styles.popup}>
      <div className={styles.content}>
        {/* Prévisualisation de la couleur */}
        <div
          className={styles.colorPreview}
          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
          title={`RGB(${r}, ${g}, ${b})`}
        >
          <span className={styles.colorValue}>RGB({r}, {g}, {b})</span>
        </div>

        {/* Sliders RGB */}
        <div className={styles.slidersContainer}>
          <RgbSlider
            value={workingColor}
            onChange={setWorkingColor}
            label=""
            showPreview={false}
          />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Boutons de validation/annulation */}
          <Flex direction="row" justify="space-between" align="center">
            <Button
              variant="secondary"
              onClick={handleCancel}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
            >
              Valider
            </Button>
          </Flex>
        </div>

        {/* Bouton de verrouillage - en dessous (seulement si pas masqué) */}
        {!hideLockButton && (
          <div className={styles.lockActions}>
            <Button
              className={styles.lockButton}
              variant="secondary"
              onClick={handleToggleLock}
            >
              {isLocked ? 'Déverrouiller' : 'Verrouiller'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}