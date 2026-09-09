import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  setTilesetTargetAtom,
  sourcePlatformAtom,
  tilesetGeometryAtom,
  tilesetTargetAtom
} from '@/app/store/tileset/tileset'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
import { SelectItem } from '@/components/ui/select'
import {
  SOURCE_PIXEL_ASPECT,
  type SourcePlatform
} from '@/libs/pixsaur-tileset'
import { LabelledSelect } from './tileset-labelled-select'
import { TileSuggestions } from './tileset-suggestions'
import styles from './tileset-workshop.module.css'

const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  'nes-ntsc': 'NES NTSC',
  'nes-pal': 'NES PAL',
  'master-system': 'Master System',
  snes: 'SNES',
  'game-boy': 'Game Boy',
  pc: 'PC'
}

/** Signed, one decimal: `+9,0 %` means nine per cent too wide for the source. */
const signedPercent = (distortion: number) =>
  `${distortion >= 0 ? '+' : '−'}${Math.abs(distortion * 100).toFixed(1)} %`

/**
 * The destination tile size and what it costs in distortion (Q1 · Q7 · Q8).
 *
 * It advises, it does not constrain: a size the source shape dislikes is
 * allowed, and the panel says how far off it is.
 */
export function TilesetGeometryPanel() {
  const { _ } = useLingui()
  const target = useAtomValue(tilesetTargetAtom)
  const setTarget = useSetAtom(setTilesetTargetAtom)
  const [platform, setPlatform] = useAtom(sourcePlatformAtom)
  const geometry = useAtomValue(tilesetGeometryAtom)

  return (
    <section className={styles.tab}>
      <Header title={<Trans>Tuile de destination</Trans>} />

      <div className={styles.fields}>
        <LabelledSelect
          label={_(msg`Machine source`)}
          value={platform}
          onValueChange={(value) => setPlatform(value as SourcePlatform)}
        >
          {Object.keys(SOURCE_PIXEL_ASPECT).map((key) => (
            <SelectItem key={key} value={key}>
              {PLATFORM_LABELS[key as SourcePlatform]}
            </SelectItem>
          ))}
        </LabelledSelect>

        <Input
          compact
          label={_(msg`Largeur cible`)}
          type='number'
          min={1}
          value={String(target.tileWidth)}
          onChange={(event) =>
            setTarget({ tileWidth: Number(event.target.value) })
          }
        />
        <Input
          compact
          label={_(msg`Hauteur cible`)}
          type='number'
          min={1}
          value={String(target.tileHeight)}
          onChange={(event) =>
            setTarget({ tileHeight: Number(event.target.value) })
          }
        />
      </div>

      <p>
        <Trans>Déformation</Trans>
        {' : '}
        <output aria-label={_(msg`Déformation`)}>
          {signedPercent(geometry.distortion)}
        </output>
      </p>

      <TileSuggestions
        title={<Trans>Tailles entières, la moins déformée en tête</Trans>}
        suggestions={geometry.candidates.map((candidate) => ({
          size: candidate,
          note: signedPercent(candidate.distortion)
        }))}
        onPick={setTarget}
      />
    </section>
  )
}
