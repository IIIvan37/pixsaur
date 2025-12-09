/**
 * Source tab - Image adjustments (brightness, contrast, saturation, etc.)
 */

import { Trans } from '@lingui/react/macro'
import { ResetIcon } from '@radix-ui/react-icons'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  configAtom,
  resetImageAdjustmentsAtom,
  setComponentAtom
} from '@/app/store/config/config'
import type { AdjustementKey } from '@/app/store/config/types'
import { workingImageAtom } from '@/app/store/image/image'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import PixsaurSlider from '@/components/ui/slider'
import styles from './tab.module.css'

type AdjustmentDef = {
  key: AdjustementKey
  label: string
  description: string
  min: number
  max: number
  step: number
}

const rgbAdjustments: AdjustmentDef[] = [
  {
    key: 'red',
    label: 'Rouge',
    description: 'Multiplie le canal rouge (0-2x)',
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'green',
    label: 'Vert',
    description: 'Multiplie le canal vert (0-2x)',
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'blue',
    label: 'Bleu',
    description: 'Multiplie le canal bleu (0-2x)',
    min: 0,
    max: 2,
    step: 0.01
  }
]

const colorAdjustments: AdjustmentDef[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    description: 'Balance bleu/orange (-100 = froid, +100 = chaud)',
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'tint',
    label: 'Teinte coloree',
    description: 'Balance vert/magenta pour corriger les dominantes',
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'vibrance',
    label: 'Vibrance',
    description: 'Saturation intelligente qui booste les couleurs ternes',
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'saturation',
    label: 'Saturation',
    description: 'Intensite des couleurs (0 = noir et blanc, 2 = tres sature)',
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'hue',
    label: 'Teinte',
    description:
      'Rotation des couleurs sur le cercle chromatique (-180 a +180)',
    min: -180,
    max: 180,
    step: 1
  }
]

const exposureAdjustments: AdjustmentDef[] = [
  {
    key: 'exposure',
    label: 'Exposition',
    description: 'Simule les stops photographiques (-3 a +3)',
    min: -3,
    max: 3,
    step: 0.1
  },
  {
    key: 'brightness',
    label: 'Luminosite',
    description: 'Ajuste la clarte globale de l image',
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'contrast',
    label: 'Contraste',
    description: 'Ajuste la difference entre les tons clairs et fonces',
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: 'highlights',
    label: 'Hautes lumieres',
    description: 'Ajuste uniquement les zones claires de l image',
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'shadows',
    label: 'Ombres',
    description: 'Ajuste uniquement les zones sombres de l image',
    min: -100,
    max: 100,
    step: 1
  },
  {
    key: 'gamma',
    label: 'Gamma',
    description:
      'Correction non-lineaire de la luminosite (0.1-3.0, 1.0 = neutre)',
    min: 0.1,
    max: 3,
    step: 0.1
  }
]

const effectsAdjustments: AdjustmentDef[] = [
  {
    key: 'posterization',
    label: 'Posterisation',
    description:
      'Reduit le nombre de niveaux de couleur pour un effet d affiche',
    min: 2,
    max: 256,
    step: 1
  }
]

export function SourceTab() {
  const config = useAtomValue(configAtom)
  const setComponent = useSetAtom(setComponentAtom)
  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const workingImage = useAtomValue(workingImageAtom)
  const disabled = !workingImage?.data

  // Default values for image adjustments
  const defaults: Record<AdjustementKey, number> = {
    red: 1,
    green: 1,
    blue: 1,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    gamma: 1,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    posterization: 256
  }

  const renderSlider = (adj: AdjustmentDef) => {
    const value = config[adj.key] as number
    const isDefault = value === defaults[adj.key]

    return (
      <div key={adj.key} className={styles.tuningRow}>
        <div className={styles.tuningHeader}>
          <span className={styles.tuningLabel}>{adj.label}</span>
          {!isDefault && (
            <button
              type='button'
              className={styles.resetButton}
              onClick={() =>
                setComponent({ key: adj.key, value: defaults[adj.key] })
              }
              disabled={disabled}
              title='Reset to default'
            >
              <ResetIcon />
            </button>
          )}
        </div>
        <PixsaurSlider
          showTooltip
          disabled={disabled}
          value={value}
          min={adj.min}
          max={adj.max}
          step={adj.step}
          onChange={(newValue: number) =>
            setComponent({ key: adj.key, value: newValue })
          }
          description={adj.description}
        />
      </div>
    )
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <div className={styles.tuningHeader}>
          <h3 className={styles.sectionTitle}>
            <Trans>Ajustements de l'image source</Trans>
          </h3>
          <button
            type='button'
            className={styles.resetButton}
            onClick={() => resetAdjustments()}
            disabled={disabled}
            title='Reset all adjustments'
          >
            <ResetIcon />
          </button>
        </div>

        <CollapsibleSection
          title={<Trans>Canaux RGB</Trans>}
          defaultOpen={false}
          disabled={disabled}
        >
          {rgbAdjustments.map(renderSlider)}
        </CollapsibleSection>

        <div className={styles.separator} />

        <CollapsibleSection
          title={<Trans>Couleur & Temperature</Trans>}
          defaultOpen={false}
          disabled={disabled}
        >
          {colorAdjustments.map(renderSlider)}
        </CollapsibleSection>

        <div className={styles.separator} />

        <CollapsibleSection
          title={<Trans>Exposition & Tonalite</Trans>}
          defaultOpen={false}
          disabled={disabled}
        >
          {exposureAdjustments.map(renderSlider)}
        </CollapsibleSection>

        <div className={styles.separator} />

        <CollapsibleSection
          title={<Trans>Effets</Trans>}
          defaultOpen={false}
          disabled={disabled}
        >
          {effectsAdjustments.map(renderSlider)}
        </CollapsibleSection>
      </div>
    </div>
  )
}
