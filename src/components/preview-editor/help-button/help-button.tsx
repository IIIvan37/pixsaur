import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import Icon from '@/components/ui/icon'
import Popover from '@/components/ui/popover'
import styles from './help-button.module.css'

type Shortcut = {
  id: string
  keys: string[]
  description: string
}

/**
 * Help button with keyboard shortcuts popover for the editor.
 */
export function HelpButton() {
  const { _ } = useLingui()
  const [open, setOpen] = useState(false)

  const shortcuts: Shortcut[] = [
    { id: 'undo', keys: ['Ctrl', 'Z'], description: _(msg`Annuler`) },
    { id: 'redo', keys: ['Ctrl', 'Y'], description: _(msg`Refaire`) },
    { id: 'zoom-in', keys: ['+'], description: _(msg`Zoom avant`) },
    { id: 'zoom-out', keys: ['-'], description: _(msg`Zoom arrière`) },
    {
      id: 'grid',
      keys: ['H'],
      description: _(msg`Afficher/masquer la grille`)
    },
    { id: 'prev-ink', keys: ['['], description: _(msg`Encre précédente`) },
    { id: 'next-ink', keys: [']'], description: _(msg`Encre suivante`) },
    {
      id: 'move',
      keys: ['↑', '↓', '←', '→'],
      description: _(msg`Déplacer le curseur`)
    },
    {
      id: 'move-fast',
      keys: ['Shift', '↑↓←→'],
      description: _(msg`Déplacement rapide (×8)`)
    },
    {
      id: 'paint-space',
      keys: ['Espace'],
      description: _(msg`Peindre au curseur`)
    },
    {
      id: 'paint-enter',
      keys: ['Entrée'],
      description: _(msg`Peindre au curseur`)
    },
    {
      id: 'save',
      keys: ['Ctrl', 'S'],
      description: _(msg`Appliquer les modifications`)
    },
    { id: 'cancel', keys: ['Échap'], description: _(msg`Annuler et fermer`) }
  ]

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side='bottom'
      align='end'
      sideOffset={8}
      trigger={
        <button
          type='button'
          className={styles.helpButton}
          title={_(msg`Aide et raccourcis`)}
        >
          <Icon name='QuestionMarkCircledIcon' size={18} />
        </button>
      }
    >
      <div className={styles.helpContent}>
        <h3 className={styles.title}>
          <Trans>Raccourcis clavier</Trans>
        </h3>
        <ul className={styles.shortcutList}>
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id} className={styles.shortcutItem}>
              <span className={styles.keys}>
                {shortcut.keys.map((key) => (
                  <span key={`${shortcut.id}-${key}`}>
                    <kbd className={styles.key}>{key}</kbd>
                    {key !== shortcut.keys[shortcut.keys.length - 1] && (
                      <span className={styles.keySeparator}>+</span>
                    )}
                  </span>
                ))}
              </span>
              <span className={styles.description}>{shortcut.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  )
}
