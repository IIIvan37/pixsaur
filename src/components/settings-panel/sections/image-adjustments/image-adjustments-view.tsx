/**
 * Image adjustments view (dumb component)
 */

import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import type { AdjustementKey } from '@/app/store/config/types'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import { Header } from '@/components/ui/layout/header/header'
import PixsaurSlider from '@/components/ui/slider'
import styles from './image-adjustments.module.css'

export type AdjustmentLabel = {
  key: AdjustementKey
  label: ReactNode
  description: ReactNode
  min: number
  max: number
  step: number
}

export type AdjustmentSection = {
  id: string
  title: ReactNode
  keys: AdjustementKey[]
}

export const sections: AdjustmentSection[] = [
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
    keys: ['posterization', 'sharpen', 'blur']
  }
]

export const labels: AdjustmentLabel[] = [
  {
    key: 'red',
    label: <Trans>Rouge</Trans>,
    description: <Trans>Multiplie le canal rouge (0-2x)</Trans>,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'green',
    label: <Trans>Vert</Trans>,
    description: <Trans>Multiplie le canal vert (0-2x)</Trans>,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'blue',
    label: <Trans>Bleu</Trans>,
    description: <Trans>Multiplie le canal bleu (0-2x)</Trans>,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'brightness',
    label: <Trans>Luminosité</Trans>,
    description: <Trans>Ajuste la clarté globale de l'image</Trans>,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'contrast',
    label: <Trans>Contraste</Trans>,
    description: (
      <Trans>Ajuste la différence entre les tons clairs et foncés</Trans>
    ),
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'saturation',
    label: <Trans>Saturation</Trans>,
    description: (
      <Trans>Intensité des couleurs (0 = noir et blanc, 2 = très saturé)</Trans>
    ),
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'hue',
    label: <Trans>Teinte</Trans>,
    description: (
      <Trans>
        Rotation des couleurs sur le cercle chromatique (-180° à +180°)
      </Trans>
    ),
    min: -180,
    max: 180,
    step: 1
  },
  {
    key: 'vibrance',
    label: <Trans>Vibrance</Trans>,
    description: (
      <Trans>
        Saturation intelligente qui booste les couleurs ternes sans sur-saturer
      </Trans>
    ),
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'temperature',
    label: <Trans>Température</Trans>,
    description: (
      <Trans>Balance bleu/orange (-100 = froid, +100 = chaud)</Trans>
    ),
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'tint',
    label: <Trans>Teinte colorée</Trans>,
    description: (
      <Trans>
        Balance vert/magenta pour corriger les dominantes de couleur
      </Trans>
    ),
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'gamma',
    label: <Trans>Gamma</Trans>,
    description: (
      <Trans>
        Correction non-linéaire de la luminosité (0.1-3.0, 1.0 = neutre)
      </Trans>
    ),
    min: 0.1,
    max: 3,
    step: 0.1
  },
  {
    key: 'exposure',
    label: <Trans>Exposition</Trans>,
    description: (
      <Trans>
        Simule les stops photographiques (-3 à +3, ±1 = double/moitié de
        lumière)
      </Trans>
    ),
    min: -3,
    max: 3,
    step: 0.1
  },
  {
    key: 'highlights',
    label: <Trans>Hautes lumières</Trans>,
    description: <Trans>Ajuste uniquement les zones claires de l'image</Trans>,
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'shadows',
    label: <Trans>Ombres</Trans>,
    description: <Trans>Ajuste uniquement les zones sombres de l'image</Trans>,
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'posterization',
    label: <Trans>Posterisation</Trans>,
    description: (
      <Trans>
        Réduit le nombre de niveaux de couleur pour un effet d'affiche
      </Trans>
    ),
    min: 2,
    max: 256,
    step: 1
  },
  {
    key: 'sharpen',
    label: <Trans>Netteté</Trans>,
    description: (
      <Trans>
        Renforce les contours pour une image plus nette (0 = off, 1 = fort)
      </Trans>
    ),
    min: 0,
    max: 2,
    step: 0.05
  },
  {
    key: 'blur',
    label: <Trans>Flou</Trans>,
    description: (
      <Trans>
        Adoucit l'image avec un flou gaussien (0 = off, 1 = maximum)
      </Trans>
    ),
    min: 0,
    max: 1,
    step: 0.05
  }
]

type ImageAdjustmentsViewProps = Readonly<{
  disabled: boolean
  values: Record<AdjustementKey, number>
  onValueChange: (key: AdjustementKey, value: number) => void
  onReset: () => void
}>

export function ImageAdjustmentsView({
  disabled,
  values,
  onValueChange,
  onReset
}: ImageAdjustmentsViewProps) {
  const renderSlider = (adj: AdjustmentLabel) => {
    const value = values[adj.key]

    return (
      <PixsaurSlider
        showTooltip
        key={adj.key}
        disabled={disabled}
        value={value}
        min={adj.min}
        max={adj.max}
        step={adj.step}
        onChange={(newValue: number) => onValueChange(adj.key, newValue)}
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
