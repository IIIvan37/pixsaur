/**
 * What the workshop's chrome remembers between two visits.
 *
 * The dock opens by default here, unlike the image workshop's: a sheet
 * converts nothing until its grid is declared by hand, so the settings *are*
 * the first step, not an afterthought.
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const tilesetSettingsOpenAtom = atomWithStorage(
  'tileset-settings-open',
  true
)

/**
 * The stage's zoom (S-Q13): « Ajuster », or a factor the user picked. One
 * zoom for every view of the stage. Not remembered: a new image starts
 * fitted.
 */
export const tilesetStageZoomAtom = atom<'fit' | number>('fit')
