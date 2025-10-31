import '@testing-library/jest-dom'
import { i18n } from '@lingui/core'
import { vi } from 'vitest'
import { messages as frMessages } from './src/locales/fr/messages'

// Initialize i18n for all tests with French (tests use French text)
i18n.load('fr', frMessages)
i18n.activate('fr')

// Mock Lingui hooks and components globally
vi.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: (key: string | { id: string }) => {
      // Handle both string keys and Lingui macro objects
      const messageKey = typeof key === 'string' ? key : key.id
      // Use the actual messages object for translation
      const messages = frMessages as Record<string, string[]>
      return messages[messageKey]?.[0] || messageKey
    }
  }),
  Trans: ({ children, id }: { children?: React.ReactNode; id?: string }) => {
    // Return children if present, otherwise translate id using messages
    if (children) return children

    const messages = frMessages as Record<string, string[]>
    return messages[id || '']?.[0] || id
  },
  msg: (key: string) => key, // Mock msg to return the key directly
  I18nProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock @lingui/core/macro
vi.mock('@lingui/core/macro', () => ({
  msg: (strings: TemplateStringsArray, ...values: any[]) => {
    // Reconstruct the message key from template literal
    const key = strings.reduce((result, string, i) => {
      return result + string + (values[i] || '')
    }, '')
    // Return an object with id property like Lingui macros do
    return { id: key }
  }
}))

globalThis.ImageData =
  globalThis.ImageData ||
  class {
    width: number
    height: number
    data: Uint8ClampedArray

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      width?: number,
      height?: number
    ) {
      if (typeof dataOrWidth === 'number' && width !== undefined) {
        // new ImageData(width, height)
        this.width = dataOrWidth
        this.height = width
        this.data = new Uint8ClampedArray(dataOrWidth * width * 4)
      } else if (width !== undefined && height !== undefined) {
        // new ImageData(data, width, height)
        this.data = new Uint8ClampedArray(dataOrWidth as Uint8ClampedArray)
        this.width = width
        this.height = height
      } else {
        throw new Error('Invalid ImageData constructor arguments')
      }
    }
  }

// Mock canvas context for tests
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-expect-error - Mock for testing
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === '2d') {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn((_x, _y, w, h) => new ImageData(w, h)),
        putImageData: vi.fn(),
        drawImage: vi.fn(),
        createImageData: vi.fn((w, h) => new ImageData(w, h)),
        canvas: {
          width: 0,
          height: 0
        },
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      } as unknown as CanvasRenderingContext2D
    }
    return null
  })
}
