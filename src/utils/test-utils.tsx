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
        } else {
          if (this._onerror) this._onerror()
        }
      }, 0)
    }
    get src() {
      return this._src
    }
  }
}
