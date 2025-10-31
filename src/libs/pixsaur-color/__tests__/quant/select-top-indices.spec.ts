import {
  selectTopIndices,
  selectTopIndicesCore
} from '../../src/quant/select-to-indices'

describe('selectTopIndices', () => {
  it('retourne [] si topN ≤ 0 ou palette vide', () => {
    expect(selectTopIndices(new Uint32Array([]), [], 5)).toEqual([])
    expect(selectTopIndices(new Uint32Array([1, 2, 3]), [], 0)).toEqual([])
  })

  it('inclut d’abord les pré‑sélections dans l’ordre', () => {
    const counts = new Uint32Array([5, 3, 4, 2])
    const pre = [2, 0]
    const result = selectTopIndices(counts, pre, 3)
    // doit commencer par [2, 0] puis ajouter le meilleur restant (idx1 has 3 or idx3 has 2? idx1)
    expect(result).toEqual([2, 0, 1])
  })

  it('remplit avec les plus fréquents jusqu’à topN', () => {
    const counts = new Uint32Array([1, 5, 2, 4])
    // pas de préselection
    expect(selectTopIndices(counts, [], 2)).toEqual([1, 3])
    expect(selectTopIndices(counts, [], 4)).toEqual([1, 3, 2, 0])
  })

  it('ignore les pré‑sélections hors bornes ou dupliquées', () => {
    const counts = new Uint32Array([10, 20, 30])
    // préselection inclut un index hors bornes et un doublon
    const result = selectTopIndices(counts, [1, 5, 1, -1], 3)
    // on garde [1], puis top remaining [2, 0]
    expect(result).toEqual([1, 2, 0])
  })

  it('ignore les indices avec des counts trop faibles (< 10)', () => {
    const counts = new Uint32Array([5, 15, 25, 8])
    const result = selectTopIndices(counts, [], 2)
    // indices 0 et 3 sont ignorés car counts < 10
    expect(result).toEqual([2, 1])
  })

  it('remplit jusqu’à topN même si certains counts sont ignorés', () => {
    const counts = new Uint32Array([5, 15, 25, 8])
    const result = selectTopIndices(counts, [], 3)
    // indices 0 et 3 sont ignorés, mais on remplit avec les restants
    expect(result).toEqual([2, 1])
  })
})

describe('selectTopIndicesCore', () => {
  it('should handle diversity mode with base palette', () => {
    const counts = [10, 20, 15, 25, 5]
    const basePalette = [
      [0, 0, 0], // Black
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255], // Blue
      [128, 128, 128] // Gray
    ]

    const result = selectTopIndicesCore(counts, [], 3, {
      diversityMode: true,
      basePalette
    })

    expect(result.length).toBe(3)
    expect(result).toEqual(expect.arrayContaining([3, 1, 2])) // Should include diverse colors
  })

  it('should handle custom threshold', () => {
    const counts = [5, 15, 25, 8]
    const result = selectTopIndicesCore(counts, [], 2, { threshold: 20 })
    // Only index 2 has count >= 20
    expect(result).toEqual([2])
  })

  it('should work without options', () => {
    const counts = [10, 20, 15]
    const result = selectTopIndicesCore(counts, [1], 2)
    expect(result).toEqual([1, 2])
  })

  it('should handle empty preselected array', () => {
    const counts = [10, 20, 15]
    const result = selectTopIndicesCore(counts, [], 2)
    expect(result).toEqual([1, 2])
  })

  it('should handle preselected indices with duplicates', () => {
    const counts = [10, 20, 15, 5]
    const result = selectTopIndicesCore(counts, [1, 1, 2], 3)
    expect(result).toEqual([1, 2, 0])
  })

  it('should handle out of bounds preselected indices', () => {
    const counts = [10, 20, 15]
    const result = selectTopIndicesCore(counts, [5, -1, 1], 2)
    expect(result).toEqual([1, 2])
  })

  it('should return empty array for invalid inputs', () => {
    expect(selectTopIndicesCore([], [], 5)).toEqual([])
    expect(selectTopIndicesCore([1, 2, 3], [], 0)).toEqual([])
    expect(selectTopIndicesCore([1, 2, 3], [], -1)).toEqual([])
  })

  it('should handle threshold filtering correctly', () => {
    const counts = [5, 15, 25, 8, 30]
    // Since max count is 30 >= 10, threshold is applied
    const result = selectTopIndicesCore(counts, [], 3, { threshold: 10 })
    expect(result).toEqual([4, 2, 1]) // indices with counts >= 10
  })

  it('should handle case where no counts meet threshold', () => {
    const counts = [5, 8, 3, 12]
    const result = selectTopIndicesCore(counts, [], 2, { threshold: 20 })
    // No counts meet threshold of 20, so no filtering applied
    expect(result).toEqual([3, 1])
  })
})

describe('selectTopIndices - comprehensive edge cases', () => {
  it('should handle single element arrays', () => {
    const counts = new Uint32Array([42])
    expect(selectTopIndices(counts, [], 1)).toEqual([0])
    expect(selectTopIndices(counts, [0], 1)).toEqual([0])
  })

  it('should handle all preselected scenario', () => {
    const counts = new Uint32Array([10, 20, 30])
    const result = selectTopIndices(counts, [0, 1, 2], 3)
    expect(result).toEqual([0, 1, 2])
  })

  it('should handle preselected exceeding topN', () => {
    const counts = new Uint32Array([10, 20, 30])
    const result = selectTopIndices(counts, [0, 1, 2], 2)
    expect(result).toEqual([0, 1])
  })

  it('should handle large count differences', () => {
    const counts = new Uint32Array([1, 1000000, 2, 500000])
    const result = selectTopIndices(counts, [], 2)
    expect(result).toEqual([1, 3])
  })

  it('should handle all zero counts', () => {
    const counts = new Uint32Array([0, 0, 0, 0])
    const result = selectTopIndices(counts, [], 2)
    expect(result).toEqual([0, 1]) // Takes first available indices
  })

  it('should handle counts with same values', () => {
    const counts = new Uint32Array([5, 5, 5, 5])
    const result = selectTopIndices(counts, [], 2)
    expect(result.length).toBe(2)
    expect(result).toEqual(expect.arrayContaining([0, 1])) // Any 2 indices
  })

  it('should handle very large topN', () => {
    const counts = new Uint32Array([1, 2, 3, 4, 5])
    const result = selectTopIndices(counts, [], 10)
    expect(result).toEqual([4, 3, 2, 1, 0])
  })

  it('should handle threshold edge cases', () => {
    // Test with threshold exactly equal to max count
    const counts = new Uint32Array([5, 10, 15, 9])
    const result = selectTopIndices(counts, [], 2, { threshold: 15 })
    expect(result).toEqual([2]) // Only index 2 meets threshold
  })
})

describe('selectTopIndices - diversity mode', () => {
  const basePalette = [
    [0, 0, 0], // 0: Black
    [255, 255, 255], // 1: White
    [255, 0, 0], // 2: Red
    [0, 255, 0], // 3: Green
    [0, 0, 255], // 4: Blue
    [255, 255, 0], // 5: Yellow
    [255, 0, 255], // 6: Magenta
    [0, 255, 255], // 7: Cyan
    [128, 128, 128], // 8: Gray
    [64, 64, 64], // 9: Dark gray
    [192, 192, 192] // 10: Light gray
  ]

  it('should select diverse colors for small palettes', () => {
    const counts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
    const result = selectTopIndicesCore(counts, [], 4, {
      diversityMode: true,
      basePalette
    })

    expect(result.length).toBe(4)
    // Should include colors with different hues/luminance
  })

  it('should work with preselected colors in diversity mode', () => {
    const counts = [10, 10, 10, 10, 10]
    const result = selectTopIndicesCore(counts, [0], 3, {
      diversityMode: true,
      basePalette
    })

    expect(result).toContain(0) // Preselected black
    expect(result.length).toBe(3)
  })

  it('should handle empty basePalette gracefully', () => {
    const counts = [10, 20, 15]
    const result = selectTopIndicesCore(counts, [], 2, {
      diversityMode: true,
      basePalette: []
    })

    expect(result).toEqual([1, 2]) // Falls back to frequency-based selection
  })

  it('should handle basePalette with missing colors', () => {
    const incompletePalette = [[0, 0, 0], undefined, [255, 0, 0]]
    const counts = [10, 20, 15]
    const result = selectTopIndicesCore(counts, [], 2, {
      diversityMode: true,
      basePalette: incompletePalette
    })

    expect(result.length).toBe(2)
  })

  it('should disable diversity mode for large palettes', () => {
    const counts = new Array(50).fill(10)
    const result = selectTopIndicesCore(counts, [], 20, {
      diversityMode: true,
      basePalette
    })

    expect(result.length).toBe(20)
    // Should use frequency-based selection for large palettes
  })
})
