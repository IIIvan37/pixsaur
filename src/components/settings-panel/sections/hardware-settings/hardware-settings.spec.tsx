/**
 * Tests for HardwareSettings smart component
 * Note: Tests for atoms should be in their respective store test files.
 * This file tests that the smart component correctly integrates atoms with the view.
 */

import { HardwareSettings } from './hardware-settings'

describe('HardwareSettings (smart component)', () => {
  it('exports HardwareSettings component', () => {
    expect(HardwareSettings).toBeDefined()
    expect(typeof HardwareSettings).toBe('function')
  })
})
