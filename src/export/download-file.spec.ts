import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadFile } from './download-file'

describe('downloadFile', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>
  let removeSpy: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()
    removeSpy = vi.fn()
    appendChildSpy = vi.fn()

    global.URL.createObjectURL = createObjectURLSpy
    global.URL.revokeObjectURL = revokeObjectURLSpy

    vi.spyOn(document, 'createElement').mockImplementation((_tag: string) => {
      const element = {
        href: '',
        download: '',
        click: clickSpy,
        remove: removeSpy
      } as unknown as HTMLAnchorElement
      return element
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should download Uint8Array data', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const filename = 'test.bin'
    const mimeType = 'application/octet-stream'

    downloadFile(data, filename, mimeType)

    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    expect(appendChildSpy).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should download Blob data', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const filename = 'test.png'

    downloadFile(blob, filename)

    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should use default mimeType when not provided', () => {
    const data = new Uint8Array([1, 2, 3])
    const filename = 'test.bin'

    downloadFile(data, filename)

    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('should handle custom mimeType', () => {
    const data = new Uint8Array([1, 2, 3])
    const filename = 'test.json'
    const mimeType = 'application/json'

    downloadFile(data, filename, mimeType)

    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('should handle Uint8Array with offset', () => {
    const buffer = new ArrayBuffer(10)
    const view = new Uint8Array(buffer, 2, 5) // offset=2, length=5
    const filename = 'test.bin'

    downloadFile(view, filename)

    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
  })
})
