import PixsaurSlider from '@/components/ui/slider'
import styles from './adjustements.module.css'

import { RangeOption } from './types'
import { AdjustementKey } from '@/app/store/config/types'

import { Panel } from '@/components/ui/layout/panel/panel'
import { Header } from '@/components/ui/layout/header/header'

type RangeLabels = {
  key: AdjustementKey
  label: string
}
// Définition des ajustements RGB (avec labels)
const labels: RangeLabels[] = [
  { key: 'red', label: 'Rouge' },
  { key: 'green', label: 'Vert' },
  { key: 'blue', label: 'Bleu' },
  { key: 'brightness', label: 'Luminosité' },
  { key: 'contrast', label: 'Contraste' },
  { key: 'saturation', label: 'Saturation' }
]

type AdjustementsViewProps = {
  disabled?: boolean
  adjustments: RangeOption
  onChange: ({ key, value }: { key: AdjustementKey; value: number }) => void
  onReset: () => void
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
        actionLabel='Réinitialiser'
        disabled={disabled}
      />

      <div className={styles.adjustmentsContainer}>
        {/* RGB Channels - with labels */}
        {labels.map((adj) => {
          const settings = adjustments[adj.key]
          return (
            <PixsaurSlider
              key={adj.key}
              disabled={disabled}
              value={settings[0]}
              min={settings[1]}
              max={settings[2]}
              step={settings[3]}
              showTooltip={false}
              onChange={(value: number) => onChange({ key: adj.key, value })}
              label={adj.label}
            />
          )
        })}
      </div>
    </Panel>
  )
}
