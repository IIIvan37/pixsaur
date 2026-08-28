/**
 * The workshop's four settings, poured into the shared dock.
 *
 * Same shell as the image workshop's — 408 px, sticky, an overlay below the lg
 * breakpoint — so the converted sheet stays in view while the settings change.
 * The tabs follow the order the work takes: where the tiles are, how big they
 * become, which colours they get, how they are drawn.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { tilesetSettingsOpenAtom } from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import {
  type DockTab,
  SettingsDock
} from '@/components/ui/layout/settings-dock'
import { TilesetGeometryPanel } from './tileset-geometry-panel'
import { TilesetGridPanel } from './tileset-grid-panel'
import { TilesetPalettePanel } from './tileset-palette-panel'
import { TilesetRenderPanel } from './tileset-render-panel'

const tabs: DockTab[] = [
  {
    id: 'grid',
    label: <Trans>Grille</Trans>,
    icon: 'GridIcon',
    component: TilesetGridPanel
  },
  {
    id: 'geometry',
    label: <Trans>Tuile</Trans>,
    icon: 'AspectRatioIcon',
    component: TilesetGeometryPanel
  },
  {
    id: 'palette',
    label: <Trans>Palette</Trans>,
    icon: 'ComponentInstanceIcon',
    component: TilesetPalettePanel
  },
  {
    id: 'render',
    label: <Trans>Rendu</Trans>,
    icon: 'BlendingModeIcon',
    component: TilesetRenderPanel
  }
]

export function TilesetSettingsDock() {
  const { _ } = useLingui()
  const [open, setOpen] = useAtom(tilesetSettingsOpenAtom)

  return (
    <SettingsDock
      open={open}
      onClose={() => setOpen(false)}
      title={<Trans>Réglages</Trans>}
      label={_(msg`Réglages du tileset`)}
      tabsLabel={_(msg`Onglets de réglages du tileset`)}
      closeLabel={_(msg`Fermer les réglages`)}
      tabs={tabs}
    />
  )
}

/** Reopens the dock — the counterpart of its close button, in the action bar. */
export function TilesetSettingsButton() {
  const [open, setOpen] = useAtom(tilesetSettingsOpenAtom)

  if (open) return null

  // No `aria-label`: the visible word is the name, and adding one would only
  // hide it behind a message id wherever the catalog has not been compiled.
  return (
    <Button variant='secondary' onClick={() => setOpen(true)}>
      <Icon name='GearIcon' />
      <span>
        <Trans>Réglages</Trans>
      </span>
    </Button>
  )
}
