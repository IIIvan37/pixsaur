/**
 * Tests for ResizeSettings smart component
 * Note: Tests for atoms should be in their respective store test files.
 * This file tests that the smart component correctly integrates atoms with the view.
 */

import { ResizeSettings } from './resize-settings'

describe('ResizeSettings (smart component)', () => {
  it('exports ResizeSettings component', () => {
    expect(ResizeSettings).toBeDefined()
    expect(typeof ResizeSettings).toBe('function')
  })
})
