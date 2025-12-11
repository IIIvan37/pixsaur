/**
 * Raster tuning panel component
 */

import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import {
  horizontalErrorCoefficientAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  rasterTuningEnabledAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import { useRasterTuningRegeneration } from '@/app/store/raster/use-raster-tuning-regeneration'
import { TuningSlider } from '@/components/settings-panel/shared/tuning-slider'
import DraggableDialog from '@/components/ui/draggable-dialog'
import Icon from '@/components/ui/icon'
import {
  HORIZONTAL_ERROR_COEFFICIENT,
  PALETTE_CONTINUITY_BONUS,
  PALETTE_CONTINUITY_DISTANCE,
  PALETTE_FREQUENCY_EXPONENT,
  VERTICAL_ERROR_COEFFICIENT
} from '@/libs/pixsaur-raster/raster-constants'
import styles from './raster-tuning-panel.module.css'

export function RasterTuningPanel() {
  const [enabled, setEnabled] = useAtom(rasterTuningEnabledAtom)

  const [verticalErrorCoef, setVerticalErrorCoef] = useAtom(
    verticalErrorCoefficientAtom
  )
  const [horizontalErrorCoef, setHorizontalErrorCoef] = useAtom(
    horizontalErrorCoefficientAtom
  )

  const [paletteContinuityDistance, setPaletteContinuityDistance] = useAtom(
    paletteContinuityDistanceAtom
  )
  const [paletteContinuityBonus, setPaletteContinuityBonus] = useAtom(
    paletteContinuityBonusAtom
  )
  const [paletteFrequencyExponent, setPaletteFrequencyExponent] = useAtom(
    paletteFrequencyExponentAtom
  )

  // Auto-regenerate rasters when tuning parameters change
  useRasterTuningRegeneration()

  return (
    <DraggableDialog
      open={enabled}
      onOpenChange={setEnabled}
      title={
        <>
          <Icon name='GearIcon' /> <Trans>Raster Tuning</Trans>
        </>
      }
      defaultPosition={{ x: 120, y: 80 }}
    >
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Trans>Dithering Error Propagation</Trans>
          </h3>

          <TuningSlider
            label='Vertical Error Coefficient'
            value={verticalErrorCoef}
            onChange={setVerticalErrorCoef}
            min={0}
            max={0.5}
            step={0.025}
            defaultValue={VERTICAL_ERROR_COEFFICIENT}
            description='Lower = less vertical banding'
          />

          <TuningSlider
            label='Horizontal Error Coefficient'
            value={horizontalErrorCoef}
            onChange={setHorizontalErrorCoef}
            min={0}
            max={1}
            step={0.05}
            defaultValue={HORIZONTAL_ERROR_COEFFICIENT}
          />
        </div>

        <div className={styles.separator} />

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Trans>Palette Selection</Trans>
          </h3>

          <TuningSlider
            label='Continuity Distance'
            value={paletteContinuityDistance}
            onChange={setPaletteContinuityDistance}
            min={200}
            max={2000}
            step={50}
            defaultValue={PALETTE_CONTINUITY_DISTANCE}
            format={(v) => v.toFixed(0)}
            description='Lower = more palette changes, higher = more stability'
          />

          <TuningSlider
            label='Continuity Bonus'
            value={paletteContinuityBonus}
            onChange={setPaletteContinuityBonus}
            min={1}
            max={3}
            step={0.1}
            defaultValue={PALETTE_CONTINUITY_BONUS}
            description='Higher = stronger preference for previous palette colors'
          />

          <TuningSlider
            label='Frequency Weight'
            value={paletteFrequencyExponent}
            onChange={setPaletteFrequencyExponent}
            min={0}
            max={1}
            step={0.05}
            defaultValue={PALETTE_FREQUENCY_EXPONENT}
            description='0 = pure diversity, 0.5 = balanced, 1 = prefer frequent colors'
          />
        </div>
      </div>
    </DraggableDialog>
  )
}
