/**
 * Image Resize Panel Component
 * Provides controls for resizing the selection with CPC constraints
 */

import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  resizeModeAtom,
  setResizeModeAtom
} from '@/app/store/config/config'
import type { ResizeMode } from '@/app/store/config/resize-types'
import Flex from '@/components/ui/flex'
import Radio from '@/components/ui/radio/radio'
import { SectionTitle } from '@/components/ui/section-title/section-title'
import styles from './image-resize-panel.module.css'

export function ImageResizePanel() {
  const resizeMode = useAtomValue(resizeModeAtom)
  const setResizeModeAction = useSetAtom(setResizeModeAtom)

  const handleModeChange = (mode: ResizeMode) => {
    setResizeModeAction(mode)
  }

  return (
    <div className={styles.panel}>
      <SectionTitle level={3}>
        <Trans>Mode de redimensionnement</Trans>
      </SectionTitle>

      {/* Mode Selection */}
      <Flex direction="row" wrap="wrap" gap="1rem" align="flex-start">
        <Radio
          name="resizeMode"
          value="auto"
          checked={resizeMode === 'auto'}
          onChange={() => handleModeChange('auto')}
          label="Auto (Smart CPC adapt)"
        />
        <Radio
          name="resizeMode"
          value="origin"
          checked={resizeMode === 'origin'}
          onChange={() => handleModeChange('origin')}
          label="Origin (No Scale)"
        />
      </Flex>
    </div>
  )
}
