import { describe, expect, it } from 'vitest'
import { quantizeCPC } from '@/utils/cpc-calculations'

// Test de la fonction de quantification CPC isolément
describe('CPC Quantization Logic', () => {
  it('should quantize values correctly', () => {
    // Test exact matches
    expect(quantizeCPC(0)).toBe(0)
    expect(quantizeCPC(128)).toBe(128)
    expect(quantizeCPC(255)).toBe(255)

    // Test rounding
    expect(quantizeCPC(63)).toBe(0) // Closer to 0 (63 vs 65)
    expect(quantizeCPC(64)).toBe(0) // Equal distance, function returns first (0)
    expect(quantizeCPC(65)).toBe(128) // Closer to 128 (63 vs 65)
    expect(quantizeCPC(191)).toBe(128) // Closer to 128 (63 vs 64)
    expect(quantizeCPC(192)).toBe(255) // Closer to 255 (64 vs 63)

    // Test the problematic value from the error
    expect(quantizeCPC(125)).toBe(128) // Should round to 128
    expect(quantizeCPC(3)).toBe(0) // Should round to 0
    expect(quantizeCPC(41)).toBe(0) // Should round to 0
  })

  it('should handle edge cases', () => {
    expect(quantizeCPC(-1)).toBe(0) // Negative values
    expect(quantizeCPC(300)).toBe(255) // Values above 255
  })
})
