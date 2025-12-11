/**
 * Resize settings component - Resize mode configuration
 */

import { Trans, useLingui } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useId } from 'react'
import {
  centerImageAtom,
  resizeModeAtom,
  setResizeModeAtom
} from '@/app/store/config/config'
import type { ResizeMode } from '@/app/store/config/resize-types'
import { selectionAtom } from '@/app/store/image/image'
import Flex from '@/components/ui/flex'
import Radio from '@/components/ui/radio/radio'
import { Switch } from '@/components/ui/switch'
import styles from '../../tabs/tab.module.css'
import localStyles from './resize-settings.module.css'

export function ResizeSettings() {
  const { t } = useLingui()
  const centerId = useId()
  const resizeMode = useAtomValue(resizeModeAtom)
  const setResizeMode = useSetAtom(setResizeModeAtom)
  const selection = useAtomValue(selectionAtom)
  const [centerImage, setCenterImage] = useAtom(centerImageAtom)

  const handleModeChange = (mode: ResizeMode) => {
    setResizeMode(mode)
  }

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Mode de redimensionnement</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Auto: redimensionnement intelligent avec correction du ratio CPC
            (recommandé). Origin: conserve la taille de sélection originale
            (pixel-perfect, pas de mise à l'échelle).
          </Trans>
        </p>

        {/* Selection dimensions info */}
        {selection && (
          <div className={localStyles.selectionInfo}>
            <Trans>Sélection</Trans>: {selection.width} × {selection.height} px
          </div>
        )}

        {/* Mode Selection with Radio buttons */}
        <Flex direction='row' wrap='wrap' gap='1rem' align='flex-start'>
          <Radio
            name='resizeMode'
            value='auto'
            checked={resizeMode === 'auto'}
            onChange={() => handleModeChange('auto')}
            label={t`Auto (Smart CPC adapt)`}
          />
          <Radio
            name='resizeMode'
            value='origin'
            checked={resizeMode === 'origin'}
            onChange={() => handleModeChange('origin')}
            label={t`Origin (No Scale)`}
          />
        </Flex>
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Centrage de l'image</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Centre automatiquement l'image dans le canvas aux dimensions CPC
            cibles.
          </Trans>
        </p>

        <Flex direction='row' gap='0.5rem' align='center'>
          <Switch
            checked={centerImage}
            onCheckedChange={setCenterImage}
            id={centerId}
          />
          <label htmlFor={centerId} className={styles.switchLabel}>
            <Trans>Centrer l'image</Trans>
          </label>
        </Flex>
      </div>
    </>
  )
}
