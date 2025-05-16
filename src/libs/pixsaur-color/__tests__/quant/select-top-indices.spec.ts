import { describe, it, expect } from 'bun:test'
import { selectTopIndices } from '../../src/quant/select-to-indices'

describe('selectTopIndices', () => {
  it('retourne [] si topN ≤ 0 ou palette vide', () => {
    expect(selectTopIndices(new Uint32Array([]), [], 5)).toEqual([])
    expect(selectTopIndices(new Uint32Array([1, 2, 3]), [], 0)).toEqual([])
  })

  it('inclut d’abord les pré‑sélections dans l’ordre', () => {
    const counts = new Uint32Array([5, 3, 4, 2])
    const pre = [2, 0]
    const result = selectTopIndices(counts, pre, 3)
    // doit commencer par [2,0] puis ajouter le meilleur restant (idx1 has 3 or idx3 has 2? idx1)
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
    // on garde [1], puis top remaining [2,0]
    expect(result).toEqual([1, 2, 0])
  })
})
