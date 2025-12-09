/**
 * Atoms for centralized settings panel
 */

import { atomWithStorage } from 'jotai/utils'

/**
 * Enable/disable settings panel
 */
export const settingsPanelEnabledAtom = atomWithStorage(
  'settings-panel-enabled',
  false
)
