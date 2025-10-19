import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { cpcHardwareAtom } from '@/app/store/config/config'
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
}

/**
 * Popup avancée de sélection de couleur avec sliders RGB
 *
 * Fonctionnalités :
 * - Sliders RGB pour ajustement précis
 * - Bouton "Valider" qui confirme et verrouille automatiquement
 * - Bouton "Déverrouiller" affiché seulement si la couleur est déjà verrouillée
 * - La popup reste ouverte pendant les ajustements
 */
export function ColorPickerPopup({
  initialColor,
  isLocked,
  onColorConfirm,
  onToggleLock,
  onClose
}: ColorPickerPopupProps) {
  // État local pour la couleur en cours d'édition
  const [workingColor, setWorkingColor] = useState<Vector>(initialColor)
  const cpcHardware = useAtomValue(cpcHardwareAtom)

  const handleConfirm = () => {
    onColorConfirm(workingColor)
    onClose()
  }

  const handleCancel = () => {
    // Restaurer la couleur initiale
    setWorkingColor(initialColor)
    onClose()
  }

  const handleUnlock = () => {
    onToggleLock()
    onClose() // Fermer la popup après déverrouillage
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
          <span className={styles.colorValue}>
            RGB({r}, {g}, {b})
          </span>
        </div>

        {/* Sliders RGB */}
        <div className={styles.slidersContainer}>
          <RgbSlider
            value={workingColor}
            onChange={setWorkingColor}
            label=''
            showPreview={false}
            hardware={cpcHardware}
          />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Boutons de validation/annulation */}
          <Flex direction='row' justify='space-between' align='center'>
            <Button variant='secondary' onClick={handleCancel}>
              <Trans>Annuler</Trans>
            </Button>
            <Button variant='primary' onClick={handleConfirm}>
              <Trans>Valider</Trans>
            </Button>
          </Flex>
        </div>

        {/* Bouton de déverrouillage - seulement si la couleur est verrouillée */}
        {isLocked && (
          <div className={styles.lockActions}>
            <Button
              className={styles.lockButton}
              variant='secondary'
              onClick={handleUnlock}
            >
              <Trans>Déverrouiller</Trans>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
