import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import Slider from '@/components/ui/slider'
import styles from '@/styles/image-converter.module.css'

import { RangeOption } from './types'
import { AdjustementKey } from '@/app/store/config/types'

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
    <div className={styles.panel} style={{ flex: 1 }}>
      <div className={styles.headerFlex}>
        <Button
          variant='reset'
          onClick={onReset}
          title='Réinitialiser les ajustements'
        >
          <Icon name='ResetIcon' className={styles.buttonIcon} />
          Réinitialiser
        </Button>
      </div>

      <div className={styles.adjustmentsContainer}>
        {/* RGB Channels - with labels */}
        {labels.map((adj) => {
          const settings = adjustments[adj.key]
          return (
            <Slider
              key={adj.key}
              disabled={disabled}
              value={settings[0]}
              min={settings[1]}
              max={settings[2]}
              step={settings[3]}
              showTooltip={false}
              onChange={(value) => onChange({ key: adj.key, value })}
              label={adj.label}
              compact
              size='small'
            />
          )
        })}
      </div>
    </div>
  )
}
