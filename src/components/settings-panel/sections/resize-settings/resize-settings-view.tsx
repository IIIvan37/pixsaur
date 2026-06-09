/**
 * Resize settings view (dumb component)
 */

import { Trans, useLingui } from '@lingui/react/macro'
import { useId } from 'react'
import type { ResizeMode } from '@/app/store/config/resize-types'
import type { ResampleStrategy } from '@/app/store/config/types'
import Flex from '@/components/ui/flex'
import Radio from '@/components/ui/radio/radio'
import { Switch } from '@/components/ui/switch'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import styles from '../../tabs/tab.module.css'
import localStyles from './resize-settings.module.css'

type ResizeSettingsViewProps = Readonly<{
  resizeMode: ResizeMode
  onResizeModeChange: (mode: ResizeMode) => void
  selection: Selection | null
  centerImage: boolean
  onCenterImageChange: (checked: boolean) => void
  showStrategy: boolean
  strategy: ResampleStrategy
  onStrategyChange: (strategy: ResampleStrategy) => void
}>

export function ResizeSettingsView({
  resizeMode,
  onResizeModeChange,
  selection,
  centerImage,
  onCenterImageChange,
  showStrategy,
  strategy,
  onStrategyChange
}: ResizeSettingsViewProps) {
  const { t } = useLingui()
  const centerId = useId()

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Mode de redimensionnement</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Auto: redimensionne pour que l'image tienne entièrement
            (recommandé). Cover: remplit les dimensions cibles en rognant
            l'excédent. Origin: conserve la taille originale (pixel-perfect).
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
            onChange={() => onResizeModeChange('auto')}
            label={t`Auto (Smart CPC adapt)`}
          />
          <Radio
            name='resizeMode'
            value='cover'
            checked={resizeMode === 'cover'}
            onChange={() => onResizeModeChange('cover')}
            label={t`Cover (Crop to fill)`}
          />
          <Radio
            name='resizeMode'
            value='origin'
            checked={resizeMode === 'origin'}
            onChange={() => onResizeModeChange('origin')}
            label={t`Origin (No Scale)`}
          />
        </Flex>
      </div>

      {showStrategy && (
        <>
          <div className={styles.separator} />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Trans>Stratégie de redimensionnement</Trans>
            </h3>
            <p className={styles.description}>
              <Trans>
                Classique: ancien redimensionnement (espace gamma). Les autres
                rééchantillonnent en lumière linéaire — Lanczos-2: plus net;
                Tent: intermédiaire; Box: le plus doux.
              </Trans>
            </p>

            <Flex direction='row' wrap='wrap' gap='1rem' align='flex-start'>
              <Radio
                name='resampleStrategy'
                value='classic'
                checked={strategy === 'classic'}
                onChange={() => onStrategyChange('classic')}
                label={t`Classique`}
              />
              <Radio
                name='resampleStrategy'
                value='box'
                checked={strategy === 'box'}
                onChange={() => onStrategyChange('box')}
                label={t`Box`}
              />
              <Radio
                name='resampleStrategy'
                value='tent'
                checked={strategy === 'tent'}
                onChange={() => onStrategyChange('tent')}
                label={t`Tent`}
              />
              <Radio
                name='resampleStrategy'
                value='lanczos2'
                checked={strategy === 'lanczos2'}
                onChange={() => onStrategyChange('lanczos2')}
                label={t`Lanczos-2`}
              />
            </Flex>
          </div>
        </>
      )}

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
            onCheckedChange={onCenterImageChange}
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
