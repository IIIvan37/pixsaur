import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import type { AdjustementKey } from '@/app/store/config/types'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import PixsaurSlider from '@/components/ui/slider'
import styles from './adjustements.module.css'
import type { RangeOption } from './types'

type RangeLabels = {
  key: AdjustementKey
  label: ReactNode
}
// Définition des ajustements RGB (avec labels)
const labels: RangeLabels[] = [
  { key: 'red', label: <Trans>Rouge</Trans> },
  { key: 'green', label: <Trans>Vert</Trans> },
  { key: 'blue', label: <Trans>Bleu</Trans> },
  { key: 'brightness', label: <Trans>Luminosité</Trans> },
  { key: 'contrast', label: <Trans>Contraste</Trans> },
  { key: 'saturation', label: <Trans>Saturation</Trans> },
  { key: 'posterization', label: <Trans>Posterisation</Trans> }
]

type AdjustementsViewProps = {
  readonly disabled?: boolean
  readonly adjustments: RangeOption
  readonly onChange: ({
    key,
    value
  }: {
    key: AdjustementKey
    value: number
  }) => void
  readonly onReset: () => void
}

export const AdjustementsView = ({
  disabled,
  adjustments,
  onChange,
  onReset
}: AdjustementsViewProps) => {
  return (
    <Panel>
      <Header
        action={onReset}
        actionLabel={<Trans>Réinitialiser</Trans>}
        disabled={disabled}
      />

      <div className={styles.adjustmentsContainer}>
        {/* RGB Channels - with labels */}
        {labels.map((adj) => {
          const settings = adjustments[adj.key]
          return (
            <PixsaurSlider
              showTooltip
              key={adj.key}
              disabled={disabled}
              value={settings[0]}
              min={settings[1]}
              max={settings[2]}
              step={settings[3]}
              onChange={(value: number) => onChange({ key: adj.key, value })}
              label={adj.label}
            />
          )
        })}
      </div>
    </Panel>
  )
}
