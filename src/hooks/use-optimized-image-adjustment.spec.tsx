import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOptimizedImageAdjustment } from './use-optimized-image-adjustment'

// Mock the processors
vi.mock('./use-image-processors', () => ({
  useImageProcessors: () => ({
    applyAdjustments: vi.fn().mockResolvedValue(new ImageData(10, 10)),
    isInitialized: true,
    isHardwareAccelerated: true
  })
}))

describe('useOptimizedImageAdjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return processing state and hardware acceleration info', () => {
    const { result } = renderHook(() => useOptimizedImageAdjustment())

    expect(result.current).toHaveProperty('isProcessing')
    expect(result.current).toHaveProperty('isHardwareAccelerated')
    expect(result.current).toHaveProperty('debounceTime')
    expect(typeof result.current.isProcessing).toBe('boolean')
    expect(typeof result.current.isHardwareAccelerated).toBe('boolean')
    expect(typeof result.current.debounceTime).toBe('number')
  })

  it('should use appropriate debounce times for different processor types', () => {
    const { result } = renderHook(() => useOptimizedImageAdjustment())

    // WebGL should have faster debounce (16ms for ~60fps)
    expect(result.current.debounceTime).toBe(16)
  })

  it('should handle non-default adjustments detection', () => {
    const { result } = renderHook(() => useOptimizedImageAdjustment())

    // Should not be processing initially
    expect(result.current.isProcessing).toBe(false)
  })
})