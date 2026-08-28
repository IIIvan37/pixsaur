import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  freezeTilesetPaletteAtom,
  setTilesetModeAtom,
  setTilesetOptionsAtom,
  thawTilesetPaletteAtom,
  tilesetHardwareAtom,
  tilesetModeAtom,
  tilesetOptionsAtom
} from '@/app/store/tileset/tileset'
import { getPaletteStrategies } from '@/components/settings-panel/sections/dithering-settings/palette-strategy-selector/palette-strategy-selector'
import Checkbox from '@/components/ui/checkbox/checkbox'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
import { Select, SelectItem } from '@/components/ui/select'
import type { PixelMode } from '@/domain/cpc'
import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { CPCHardware } from '@/libs/types'
import styles from './tileset-workshop.module.css'

const MODES: PixelMode[] = [0, 1, 2]

/**
 * The pens the whole tileset shares (Q15 · Q16 · Q23 · Q26 · Q28).
 *
 * One palette for the sheet: the CPC has one at a time. Reservation and
 * transparency both spend out of the mode's budget, which is why they are
 * settled here and not next to the rendering.
 */
export function TilesetPalettePanel() {
  const { _ } = useLingui()
  const mode = useAtomValue(tilesetModeAtom)
  const setMode = useSetAtom(setTilesetModeAtom)
  const [hardware, setHardware] = useAtom(tilesetHardwareAtom)
  const options = useAtomValue(tilesetOptionsAtom)
  const setOptions = useSetAtom(setTilesetOptionsAtom)
  const freeze = useSetAtom(freezeTilesetPaletteAtom)
  const thaw = useSetAtom(thawTilesetPaletteAtom)

  // Modes 1 and 2 have 4 and 2 pens: nothing to reserve, nothing to spend on a
  // hole. Q16 — the arithmetic, not a preference.
  const spendable = mode === 0

  return (
    <section className={styles.tab}>
      <Header title={<Trans>Palette</Trans>} />

      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Mode</Trans>
          </span>
          <Select
            aria-label={_(msg`Mode`)}
            value={String(mode)}
            onValueChange={(value) => setMode(Number(value) as PixelMode)}
          >
            {MODES.map((key) => (
              <SelectItem key={key} value={String(key)}>
                {`Mode ${key}`}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Machine CPC</Trans>
          </span>
          <Select
            aria-label={_(msg`Machine CPC`)}
            value={hardware}
            onValueChange={(value) => setHardware(value as CPCHardware)}
          >
            <SelectItem value='classic'>CPC</SelectItem>
            <SelectItem value='plus'>CPC Plus</SelectItem>
          </Select>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>
            <Trans>Stratégie de palette</Trans>
          </span>
          <Select
            aria-label={_(msg`Stratégie de palette`)}
            value={options.paletteStrategy ?? 'exhaustive-contrast'}
            onValueChange={(value) =>
              setOptions({ paletteStrategy: value as PaletteStrategy })
            }
          >
            {getPaletteStrategies(_).map((strategy) => (
              <SelectItem key={strategy.value} value={strategy.value}>
                {strategy.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        <Input
          compact
          label={_(msg`Pens réservés`)}
          type='number'
          min={0}
          disabled={!spendable}
          value={String(options.reservedPens ?? 0)}
          onChange={(event) =>
            setOptions({ reservedPens: Number(event.target.value) })
          }
        />

        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Transparence</Trans>
          </span>
          <Select
            aria-label={_(msg`Transparence`)}
            value={options.transparency ?? (spendable ? 'pen' : 'flatten')}
            onValueChange={(value) =>
              setOptions({ transparency: value as 'pen' | 'flatten' })
            }
            disabled={!spendable}
          >
            <SelectItem value='pen'>
              {_(msg`Un pen dépensé pour les trous`)}
            </SelectItem>
            <SelectItem value='flatten'>
              {_(msg`Trous aplatis sur le fond`)}
            </SelectItem>
          </Select>
        </div>
      </div>

      <Checkbox
        label={_(msg`Geler la palette`)}
        checked={options.palette !== undefined}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          event.target.checked ? freeze() : thaw()
        }
      />
      <p className={styles.note}>
        <Trans>
          Une palette gelée est utilisée telle quelle : les retouches sont des
          index de pen, elles survivent à un changement de réglage.
        </Trans>
      </p>
    </section>
  )
}
