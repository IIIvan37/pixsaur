import { atom, useAtom } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import {
  createGradientImageData,
  createTestImageData,
  mockGlobalImage,
  renderWithI18n,
  renderWithJotai,
  renderWithProviders
} from './test-utils'

describe('test-utils', () => {
  describe('renderWithI18n', () => {
    it('should render component with I18n provider', () => {
      function TestComponent() {
        return <div>Content with I18n</div>
      }

      const { getByText } = renderWithI18n(<TestComponent />)
      expect(getByText('Content with I18n')).toBeDefined()
    })

    it('should pass options to render', () => {
      function TestComponent() {
        return <div data-testid='test'>Content</div>
      }

      const { getByTestId } = renderWithI18n(<TestComponent />)
      expect(getByTestId('test')).toBeDefined()
    })
  })

  describe('renderWithJotai', () => {
    it('should render component with Jotai provider', () => {
      const testAtom = atom(42)

      function TestComponent() {
        const [value] = useAtom(testAtom)
        return <div>Value: {value}</div>
      }

      const { getByText } = renderWithJotai(<TestComponent />)
      expect(getByText('Value: 42')).toBeDefined()
    })

    it('should allow atom state updates', async () => {
      const countAtom = atom(0)

      function TestComponent() {
        const [count, setCount] = useAtom(countAtom)
        return (
          <div>
            <span>Count: {count}</span>
            <button type='button' onClick={() => setCount(count + 1)}>
              Increment
            </button>
          </div>
        )
      }

      const { getByText, findByText } = renderWithJotai(<TestComponent />)
      expect(getByText('Count: 0')).toBeDefined()

      getByText('Increment').click()
      expect(await findByText('Count: 1')).toBeDefined()
    })
  })

  describe('renderWithProviders', () => {
    it('should render component with both I18n and Jotai providers', () => {
      const testAtom = atom('test-value')

      function TestComponent() {
        const [value] = useAtom(testAtom)
        return (
          <div>
            <span>Label</span>
            <span>Atom: {value}</span>
          </div>
        )
      }

      const { getByText } = renderWithProviders(<TestComponent />)
      expect(getByText('Label')).toBeDefined()
      expect(getByText('Atom: test-value')).toBeDefined()
    })

    it('should support both provider features simultaneously', async () => {
      const countAtom = atom(10)

      function TestComponent() {
        const [count, setCount] = useAtom(countAtom)
        return (
          <div>
            <span>Count: {count}</span>
            <button type='button' onClick={() => setCount(count * 2)}>
              Double
            </button>
          </div>
        )
      }

      const { getByText, findByText } = renderWithProviders(<TestComponent />)
      expect(getByText('Count: 10')).toBeDefined()

      getByText('Double').click()
      expect(await findByText('Count: 20')).toBeDefined()
    })
  })

  describe('mockGlobalImage', () => {
    it('should mock global Image constructor', () => {
      mockGlobalImage()

      expect(globalThis.Image).toBeDefined()
      const img = new Image()
      expect(img).toBeDefined()
    })

    it('should trigger onload for data URLs', async () => {
      mockGlobalImage()

      const img = new Image()
      const onloadSpy = vi.fn()
      img.onload = onloadSpy

      img.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      await vi.waitFor(() => {
        expect(onloadSpy).toHaveBeenCalled()
      })
    })

    it('should trigger onerror for invalid URLs', async () => {
      mockGlobalImage()

      const img = new Image()
      const onerrorSpy = vi.fn()
      img.onerror = onerrorSpy

      img.src = 'http://invalid-url.test/image.png'

      await vi.waitFor(() => {
        expect(onerrorSpy).toHaveBeenCalled()
      })
    })

    it('should set and get src property', () => {
      mockGlobalImage()

      const img = new Image()
      img.src = 'data:image/png;base64,test'
      expect(img.src).toBe('data:image/png;base64,test')
    })
  })

  describe('createTestImageData', () => {
    it('should create ImageData with default white color', () => {
      const imageData = createTestImageData(2, 2)

      expect(imageData.width).toBe(2)
      expect(imageData.height).toBe(2)
      expect(imageData.data.length).toBe(16) // 2 * 2 * 4 (RGBA)

      // Check first pixel is white (255, 255, 255, 255)
      expect(imageData.data[0]).toBe(255) // R
      expect(imageData.data[1]).toBe(255) // G
      expect(imageData.data[2]).toBe(255) // B
      expect(imageData.data[3]).toBe(255) // A
    })

    it('should create ImageData with custom color', () => {
      const red: [number, number, number, number] = [255, 0, 0, 255]
      const imageData = createTestImageData(3, 3, red)

      expect(imageData.width).toBe(3)
      expect(imageData.height).toBe(3)

      // Check all pixels are red
      for (let i = 0; i < imageData.data.length; i += 4) {
        expect(imageData.data[i]).toBe(255) // R
        expect(imageData.data[i + 1]).toBe(0) // G
        expect(imageData.data[i + 2]).toBe(0) // B
        expect(imageData.data[i + 3]).toBe(255) // A
      }
    })

    it('should create ImageData with semi-transparent color', () => {
      const semiTransparent: [number, number, number, number] = [
        128, 128, 128, 128
      ]
      const imageData = createTestImageData(1, 1, semiTransparent)

      expect(imageData.data[0]).toBe(128) // R
      expect(imageData.data[1]).toBe(128) // G
      expect(imageData.data[2]).toBe(128) // B
      expect(imageData.data[3]).toBe(128) // A (50% transparent)
    })

    it('should create ImageData with black color', () => {
      const black: [number, number, number, number] = [0, 0, 0, 255]
      const imageData = createTestImageData(4, 4, black)

      expect(imageData.width).toBe(4)
      expect(imageData.height).toBe(4)

      // Check first pixel is black
      expect(imageData.data[0]).toBe(0) // R
      expect(imageData.data[1]).toBe(0) // G
      expect(imageData.data[2]).toBe(0) // B
      expect(imageData.data[3]).toBe(255) // A
    })

    it('should handle 1x1 image', () => {
      const imageData = createTestImageData(1, 1)

      expect(imageData.width).toBe(1)
      expect(imageData.height).toBe(1)
      expect(imageData.data.length).toBe(4) // 1 pixel * 4 channels
    })

    it('should handle large images', () => {
      const imageData = createTestImageData(320, 200)

      expect(imageData.width).toBe(320)
      expect(imageData.height).toBe(200)
      expect(imageData.data.length).toBe(320 * 200 * 4) // 256000
    })
  })

  describe('createGradientImageData', () => {
    it('should create gradient ImageData', () => {
      const imageData = createGradientImageData(10, 5)

      expect(imageData.width).toBe(10)
      expect(imageData.height).toBe(5)
      expect(imageData.data.length).toBe(10 * 5 * 4) // 200
    })

    it('should have gradient from left (R=0) to right (R=255)', () => {
      const imageData = createGradientImageData(10, 1)

      // First pixel: R should be ~0
      expect(imageData.data[0]).toBe(0)

      // Last pixel: R should be 255
      const lastPixelIndex = (10 - 1) * 4
      expect(imageData.data[lastPixelIndex]).toBe(255)
    })

    it('should have inverse gradient for G channel', () => {
      const imageData = createGradientImageData(10, 1)

      // First pixel: G should be 255
      expect(imageData.data[1]).toBe(255)

      // Last pixel: G should be ~0
      const lastPixelIndex = (10 - 1) * 4
      expect(imageData.data[lastPixelIndex + 1]).toBe(0)
    })

    it('should have constant B channel at 128', () => {
      const imageData = createGradientImageData(10, 5)

      // Check all B values are 128
      for (let i = 2; i < imageData.data.length; i += 4) {
        expect(imageData.data[i]).toBe(128)
      }
    })

    it('should have fully opaque alpha channel', () => {
      const imageData = createGradientImageData(10, 5)

      // Check all alpha values are 255
      for (let i = 3; i < imageData.data.length; i += 4) {
        expect(imageData.data[i]).toBe(255)
      }
    })

    it('should create gradient for each row', () => {
      const imageData = createGradientImageData(5, 3)

      // Each row should have the same gradient pattern
      for (let row = 0; row < 3; row++) {
        const rowStart = row * 5 * 4

        // First pixel of row: R=0, G=255
        expect(imageData.data[rowStart]).toBe(0)
        expect(imageData.data[rowStart + 1]).toBe(255)

        // Last pixel of row: R=255, G=0
        const rowEnd = rowStart + 4 * 4
        expect(imageData.data[rowEnd]).toBe(255)
        expect(imageData.data[rowEnd + 1]).toBe(0)
      }
    })

    it('should handle minimum size (2x2)', () => {
      const imageData = createGradientImageData(2, 2)

      expect(imageData.width).toBe(2)
      expect(imageData.height).toBe(2)
      expect(imageData.data.length).toBe(16) // 2 * 2 * 4
    })

    it('should create proper gradient with middle values', () => {
      const imageData = createGradientImageData(5, 1)

      // x=0: R=0, G=255
      expect(imageData.data[0]).toBe(0)
      expect(imageData.data[1]).toBe(255)

      // x=2 (middle): R≈128, G≈128
      const middleIndex = 2 * 4
      expect(imageData.data[middleIndex]).toBeGreaterThan(100)
      expect(imageData.data[middleIndex]).toBeLessThan(155)
      expect(imageData.data[middleIndex + 1]).toBeGreaterThan(100)
      expect(imageData.data[middleIndex + 1]).toBeLessThan(155)

      // x=4 (end): R=255, G=0
      const endIndex = 4 * 4
      expect(imageData.data[endIndex]).toBe(255)
      expect(imageData.data[endIndex + 1]).toBe(0)
    })
  })
})
