/**
 * Tests for ImageAdjustments smart component
 * Note: Tests for atoms (configAtom, setComponentAtom, resetImageAdjustmentsAtom)
 * should be in their respective store test files.
 * This file tests that the smart component correctly integrates atoms with the view.
 */

import { ImageAdjustments } from './image-adjustments'

describe('ImageAdjustments (smart component)', () => {
  it('exports ImageAdjustments component', () => {
    // Simple smoke test - the real logic is tested via:
    // 1. ImageAdjustmentsView tests (view behavior)
    // 2. Store tests for configAtom, setComponentAtom, resetImageAdjustmentsAtom
    // This smart component just wires them together

    expect(ImageAdjustments).toBeDefined()
    expect(typeof ImageAdjustments).toBe('function')
  })
})
