/** Mock global.Image for image-loading tests in jsdom */
export function mockGlobalImage() {
  // @ts-expect-error: Mocking global.Image for jsdom environment in tests
  global.Image = class {
    _src = ''
    _onload: (() => void) | null = null
    _onerror: (() => void) | null = null
    set onload(fn: () => void) {
      this._onload = fn
    }
    set onerror(fn: () => void) {
      this._onerror = fn
    }
    set src(val: string) {
      this._src = val
      setTimeout(() => {
        if (val.startsWith('data:image/')) {
          if (this._onload) this._onload()
        } else if (this._onerror) {
          this._onerror()
        }
      }, 0)
    }
    get src() {
      return this._src
    }
  }
}

/**
 * Créer ImageData pour les tests avec couleur optionnelle
 */
export function createTestImageData(
  width: number,
  height: number,
  fillColor: [number, number, number, number] = [255, 255, 255, 255]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillColor[0] // R
    data[i + 1] = fillColor[1] // G
    data[i + 2] = fillColor[2] // B
    data[i + 3] = fillColor[3] // A
  }

  return new ImageData(data, width, height)
}

/**
 * Créer ImageData avec pattern de gradient pour tests
 */
export function createGradientImageData(
  width: number,
  height: number
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      const progress = x / (width - 1)

      data[index] = Math.round(255 * progress) // R gradient
      data[index + 1] = Math.round(255 * (1 - progress)) // G inverse
      data[index + 2] = 128 // B constant
      data[index + 3] = 255 // A opaque
    }
  }

  return new ImageData(data, width, height)
}
