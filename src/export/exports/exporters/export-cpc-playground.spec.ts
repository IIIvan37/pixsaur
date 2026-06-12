import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModeRSnaExportOptions, SnaExportOptions } from './export-sna'

// Mock @/core logger
vi.mock('@/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  })
}))

// Mock @/tauri
const mockIsTauri = vi.fn()
vi.mock('@/tauri', () => ({
  isTauri: () => mockIsTauri()
}))

// Mock @tauri-apps/plugin-shell
const mockTauriOpen = vi.fn()
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => mockTauriOpen(url)
}))

// Mock generateSnaAsmSource and generateModeRSnaAsmSource
const mockGenerateSnaAsmSource = vi.fn()
const mockGenerateModeRSnaAsmSource = vi.fn()
vi.mock('./export-sna', () => ({
  generateSnaAsmSource: (options: SnaExportOptions) =>
    mockGenerateSnaAsmSource(options),
  generateModeRSnaAsmSource: (options: ModeRSnaExportOptions) =>
    mockGenerateModeRSnaAsmSource(options)
}))

// Mock window.open
const mockWindowOpen = vi.fn()
vi.stubGlobal('open', mockWindowOpen)

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('export-cpc-playground', () => {
  const defaultOptions: SnaExportOptions = {
    indexBuf: new Uint8Array([0, 1, 2, 3]),
    modeConfig: {
      mode: 0,
      width: 160,
      height: 200,
      overscan: false,
      nColors: 16,
      scaleX: 2,
      scaleY: 1
    },
    hardware: 'classic',
    paletteFirmware: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    hasRasters: false
  }

  beforeEach(() => {
    // No vi.resetModules(): the module under test holds no eval-time state and
    // reads every mock at call time, so re-instantiating it per test only
    // re-pays the cold transform cost (the source of the load flakiness).
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(false)
    mockGenerateSnaAsmSource.mockReturnValue('; Test ASM source')
    mockGenerateModeRSnaAsmSource.mockReturnValue('; Test Mode R ASM source')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'test-share-id' })
    })
  })

  describe('exportToCpcPlayground', () => {
    it('should return error when ASM source generation fails', async () => {
      mockGenerateSnaAsmSource.mockReturnValue(null)

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate ASM source code'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should call share API with generated ASM source', async () => {
      const asmSource = '; Generated ASM code\nORG &4000'
      mockGenerateSnaAsmSource.mockReturnValue(asmSource)

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(defaultOptions)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org/api/share',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code: asmSource })
        }
      )
    })

    it('should return error when API returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'Server error'
      })
    })

    it('should return error with HTTP status when API error has no message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({})
      })

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'HTTP 503'
      })
    })

    it('should return error when no share ID returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'No share ID returned'
      })
    })

    it('should return success with share URL', async () => {
      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: true,
        shareUrl: 'https://cpc-playground.iiivan.org?share=test-share-id'
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('String error')

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      const result = await exportToCpcPlayground(defaultOptions)

      expect(result).toEqual({
        success: false,
        error: 'String error'
      })
    })
  })

  describe('browser opening', () => {
    it('should use window.open in web environment', async () => {
      mockIsTauri.mockReturnValue(false)

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(defaultOptions)

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org?share=test-share-id',
        '_blank'
      )
      expect(mockTauriOpen).not.toHaveBeenCalled()
    })

    it('should use Tauri shell open in Tauri environment', async () => {
      mockIsTauri.mockReturnValue(true)

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(defaultOptions)

      expect(mockTauriOpen).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org?share=test-share-id'
      )
      expect(mockWindowOpen).not.toHaveBeenCalled()
    })
  })

  describe('hardware support', () => {
    it('should pass classic hardware options to ASM generator', async () => {
      const classicOptions: SnaExportOptions = {
        ...defaultOptions,
        hardware: 'classic',
        paletteFirmware: [0, 1, 2, 3]
      }

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(classicOptions)

      expect(mockGenerateSnaAsmSource).toHaveBeenCalledWith(classicOptions)
    })

    it('should pass plus hardware options to ASM generator', async () => {
      const plusOptions: SnaExportOptions = {
        ...defaultOptions,
        hardware: 'plus',
        palettePlus: [0x000, 0xfff, 0x00f, 0x0f0]
      }

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(plusOptions)

      expect(mockGenerateSnaAsmSource).toHaveBeenCalledWith(plusOptions)
    })

    it('should pass raster options to ASM generator', async () => {
      const rasterOptions: SnaExportOptions = {
        ...defaultOptions,
        hasRasters: true,
        rasterAsm: '; Raster data here'
      }

      const { exportToCpcPlayground } = await import('./export-cpc-playground')
      await exportToCpcPlayground(rasterOptions)

      expect(mockGenerateSnaAsmSource).toHaveBeenCalledWith(rasterOptions)
    })
  })

  describe('exportModeRToCpcPlayground', () => {
    const defaultModeROptions: ModeRSnaExportOptions = {
      indexBufA: new Uint8Array([0, 1, 2, 3]),
      indexBufB: new Uint8Array([4, 5, 6, 7]),
      modeConfig: {
        mode: 0,
        width: 160,
        height: 200,
        overscan: false,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      },
      hardware: 'classic',
      paletteAFirmware: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      paletteBFirmware: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    }

    it('should return error when Mode R ASM source generation fails', async () => {
      mockGenerateModeRSnaAsmSource.mockReturnValue(null)

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      const result = await exportModeRToCpcPlayground(defaultModeROptions)

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate Mode R ASM source code'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should call share API with generated Mode R ASM source', async () => {
      const asmSource = '; Mode R Generated ASM code'
      mockGenerateModeRSnaAsmSource.mockReturnValue(asmSource)

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      await exportModeRToCpcPlayground(defaultModeROptions)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org/api/share',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code: asmSource })
        }
      )
    })

    it('should return success with share URL for Mode R', async () => {
      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      const result = await exportModeRToCpcPlayground(defaultModeROptions)

      expect(result).toEqual({
        success: true,
        shareUrl: 'https://cpc-playground.iiivan.org?share=test-share-id'
      })
    })

    it('should return error when API returns non-ok response for Mode R', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      const result = await exportModeRToCpcPlayground(defaultModeROptions)

      expect(result).toEqual({
        success: false,
        error: 'Server error'
      })
    })

    it('should handle network errors gracefully for Mode R', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      const result = await exportModeRToCpcPlayground(defaultModeROptions)

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      })
    })

    it('should pass classic hardware options to Mode R ASM generator', async () => {
      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      await exportModeRToCpcPlayground(defaultModeROptions)

      expect(mockGenerateModeRSnaAsmSource).toHaveBeenCalledWith(
        defaultModeROptions
      )
    })

    it('should pass plus hardware options to Mode R ASM generator', async () => {
      const plusOptions: ModeRSnaExportOptions = {
        ...defaultModeROptions,
        hardware: 'plus',
        paletteAFirmware: undefined,
        paletteBFirmware: undefined,
        paletteAPlus: [0x000, 0xfff, 0x00f, 0x0f0],
        paletteBPlus: [0xf00, 0x0ff, 0xff0, 0xf0f]
      }

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      await exportModeRToCpcPlayground(plusOptions)

      expect(mockGenerateModeRSnaAsmSource).toHaveBeenCalledWith(plusOptions)
    })

    it('should use window.open in web environment for Mode R', async () => {
      mockIsTauri.mockReturnValue(false)

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      await exportModeRToCpcPlayground(defaultModeROptions)

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org?share=test-share-id',
        '_blank'
      )
      expect(mockTauriOpen).not.toHaveBeenCalled()
    })

    it('should use Tauri shell open in Tauri environment for Mode R', async () => {
      mockIsTauri.mockReturnValue(true)

      const { exportModeRToCpcPlayground } = await import(
        './export-cpc-playground'
      )
      await exportModeRToCpcPlayground(defaultModeROptions)

      expect(mockTauriOpen).toHaveBeenCalledWith(
        'https://cpc-playground.iiivan.org?share=test-share-id'
      )
      expect(mockWindowOpen).not.toHaveBeenCalled()
    })
  })
})
