import { correctColorIndicesForCPC } from './correct-indices'

describe('correctColorIndicesForCPC', () => {
  it('should swap bits 1 and 2 of color indices', () => {
    // Test cases based on our analysis
    const input = new Uint8Array([2, 3, 4, 5]) // Pixsaur indices
    const expected = new Uint8Array([4, 5, 2, 3]) // Expected Img2CPC indices

    const result = correctColorIndicesForCPC(input)

    expect(Array.from(result)).toEqual(Array.from(expected))
  })

  it('should handle individual transformations correctly', () => {
    // Test individual cases
    const testCases = [
      { input: 2, expected: 4 }, // 0010 -> 0100 (bit 1->2, bit 2->1)
      { input: 3, expected: 5 }, // 0011 -> 0101
      { input: 4, expected: 2 }, // 0100 -> 0010
      { input: 5, expected: 3 }, // 0101 -> 0011 (correction)
      { input: 0, expected: 0 }, // 0000 -> 0000 (no change)
      { input: 15, expected: 15 } // 1111 -> 1111 (no change)
    ]

    for (const { input, expected } of testCases) {
      const inputBuffer = new Uint8Array([input])
      const result = correctColorIndicesForCPC(inputBuffer)
      expect(result[0]).toBe(expected)
    }
  })

  it('should preserve other bits unchanged', () => {
    // Test that bits 0 and 3 are not affected
    const input = new Uint8Array([9]) // 1001 -> should become 1001 (bits 1&2 are 0)
    const result = correctColorIndicesForCPC(input)
    expect(result[0]).toBe(9)
  })
})
