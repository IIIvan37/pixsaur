/**
 * Image Resize Panel Component
 * Provides controls for resizing the selection with CPC constraints
 */

import { Trans, useLingui } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useId } from 'react'
import {
  centerImageAtom,
  resizeModeAtom,
  setResizeModeAtom
} from '@/app/store/config/config'
import { selectionAtom } from '@/app/store/image/image'
import type { ResizeMode } from '@/app/store/config/resize-types'
import Flex from '@/components/ui/flex'
import Radio from '@/components/ui/radio/radio'
import { SectionTitle } from '@/components/ui/section-title/section-title'
import { Switch } from '@/components/ui/switch'
import styles from './image-resize-panel.module.css'

export function ImageResizePanel() {
  const { t } = useLingui()
  const centerId = useId()
  const resizeMode = useAtomValue(resizeModeAtom)
  const selection = useAtomValue(selectionAtom)
  const [centerImage, setCenterImage] = useAtom(centerImageAtom)
  const setResizeModeAction = useSetAtom(setResizeModeAtom)

  const handleModeChange = (mode: ResizeMode) => {
    setResizeModeAction(mode)
  }

  return (
    <div className={styles.panel}>
      <SectionTitle level={3}>
        <Trans>Mode de redimensionnement</Trans>
      </SectionTitle>

      {/* Selection dimensions info */}
      {selection && (
        <div className={styles.selectionInfo}>
          <Trans>Sélection</Trans>: {selection.width} × {selection.height} px
        </div>
      )}

      {/* Mode Selection */}
      <Flex direction="row" wrap="wrap" gap="1rem" align="flex-start">
        <Radio
          name="resizeMode"
          value="auto"
          checked={resizeMode === 'auto'}
          onChange={() => handleModeChange('auto')}
          label={t`Auto (Smart CPC adapt)`}
        />
        <Radio
          name="resizeMode"
          value="origin"
          checked={resizeMode === 'origin'}
          onChange={() => handleModeChange('origin')}
          label={t`Origin (No Scale)`}
        />
      </Flex>

      {/* Center image option */}
      <Flex direction="row" gap="0.5rem" align="center">
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
  )
}
