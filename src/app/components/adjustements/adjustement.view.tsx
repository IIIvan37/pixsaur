import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import type { AdjustementKey } from '@/app/store/config/types'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import { Header } from '@/components/ui/layout/header/header'
import PixsaurSlider from '@/components/ui/slider'
import styles from './adjustements.module.css'
import type { RangeOption } from './types'

type RangeLabels = {
  key: AdjustementKey
  label: ReactNode
  description: ReactNode
}

type AdjustmentSection = {
  id: string
  title: ReactNode
  keys: AdjustementKey[]
}

// Définition des sections d'ajustements
const sections: AdjustmentSection[] = [
  {
    id: 'rgb',
    title: <Trans>Canaux RGB</Trans>,
    keys: ['red', 'green', 'blue']
  },
  {
    id: 'color',
    title: <Trans>Couleur & Température</Trans>,
    keys: ['temperature', 'tint', 'vibrance', 'saturation', 'hue']
  },
  {
    id: 'exposure',
    title: <Trans>Exposition & Tonalité</Trans>,
    keys: [
      'exposure',
      'brightness',
      'contrast',
      'highlights',
      'shadows',
      'gamma'
    ]
  },
  {
    id: 'effects',
    title: <Trans>Effets</Trans>,
    keys: ['posterization']
  }
]

// Définition des ajustements RGB (avec labels)
const labels: RangeLabels[] = [
  {
    key: 'red',
    label: <Trans>Rouge</Trans>,
    description: <Trans>Multiplie le canal rouge (0-2x)</Trans>
  },
  {
    key: 'green',
    label: <Trans>Vert</Trans>,
    description: <Trans>Multiplie le canal vert (0-2x)</Trans>
  },
  {
    key: 'blue',
    label: <Trans>Bleu</Trans>,
    description: <Trans>Multiplie le canal bleu (0-2x)</Trans>
  },
  {
    key: 'brightness',
    label: <Trans>Luminosité</Trans>,
    description: <Trans>Ajuste la clarté globale de l'image</Trans>
  },
  {
    key: 'contrast',
    label: <Trans>Contraste</Trans>,
    description: (
      <Trans>Ajuste la différence entre les tons clairs et foncés</Trans>
    )
  },
  {
    key: 'saturation',
    label: <Trans>Saturation</Trans>,
    description: (
      <Trans>Intensité des couleurs (0 = noir et blanc, 2 = très saturé)</Trans>
    )
  },
  {
    key: 'hue',
    label: <Trans>Teinte</Trans>,
    description: (
      <Trans>
        Rotation des couleurs sur le cercle chromatique (-180° à +180°)
      </Trans>
    )
  },
  {
    key: 'vibrance',
    label: <Trans>Vibrance</Trans>,
    description: (
      <Trans>
        Saturation intelligente qui booste les couleurs ternes sans sur-saturer
      </Trans>
    )
  },
  {
    key: 'temperature',
    label: <Trans>Température</Trans>,
    description: <Trans>Balance bleu/orange (-100 = froid, +100 = chaud)</Trans>
  },
  {
    key: 'tint',
    label: <Trans>Teinte colorée</Trans>,
    description: (
      <Trans>
        Balance vert/magenta pour corriger les dominantes de couleur
      </Trans>
    )
  },
  {
    key: 'gamma',
    label: <Trans>Gamma</Trans>,
    description: (
      <Trans>
        Correction non-linéaire de la luminosité (0.1-3.0, 1.0 = neutre)
      </Trans>
    )
  },
  {
    key: 'exposure',
    label: <Trans>Exposition</Trans>,
    description: (
      <Trans>
        Simule les stops photographiques (-3 à +3, ±1 = double/moitié de
        lumière)
      </Trans>
    )
  },
  {
    key: 'highlights',
    label: <Trans>Hautes lumières</Trans>,
    description: <Trans>Ajuste uniquement les zones claires de l'image</Trans>
  },
  {
    key: 'shadows',
    label: <Trans>Ombres</Trans>,
    description: <Trans>Ajuste uniquement les zones sombres de l'image</Trans>
  },
  {
    key: 'posterization',
    label: <Trans>Posterisation</Trans>,
    description: (
      <Trans>
        Réduit le nombre de niveaux de couleur pour un effet d'affiche
        (256=normal, 128=léger, 64=modéré, 32=fort, 16=très fort, 8=extrême,
        4=monochrome, 2=binaire)
      </Trans>
    )
  }
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
  const renderSlider = (adj: RangeLabels) => {
    const settings = adjustments[adj.key]
    if (!settings) return null

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
        description={adj.description}
      />
    )
  }

  return (
    <div className={styles.adjustmentsWrapper}>
      <Header
        action={onReset}
        actionLabel={<Trans>Réinitialiser</Trans>}
        disabled={disabled}
      />

      <div className={styles.sectionsContainer}>
        {sections.map((section) => {
          const sectionLabels = labels.filter((l) =>
            section.keys.includes(l.key)
          )

          return (
            <CollapsibleSection
              key={section.id}
              title={section.title}
              defaultOpen={false}
              disabled={disabled}
            >
              <div className={styles.sliderGrid}>
                {sectionLabels.map(renderSlider)}
              </div>
            </CollapsibleSection>
          )
        })}
      </div>
    </div>
  )
}
