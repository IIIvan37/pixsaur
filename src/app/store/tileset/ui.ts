/**
 * What the workshop's chrome remembers between two visits.
 *
 * The dock opens by default here, unlike the image workshop's: a sheet
 * converts nothing until its grid is declared by hand, so the settings *are*
 * the first step, not an afterthought.
 */

import { atomWithStorage } from 'jotai/utils'

export const tilesetSettingsOpenAtom = atomWithStorage(
  'tileset-settings-open',
  true
)
