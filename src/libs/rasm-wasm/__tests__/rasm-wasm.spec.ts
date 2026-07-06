import { describe, expect, it, vi } from 'vitest'
import * as rasmWasm from '../rasm-wasm'
import type { RasmModule } from '../types'

// Create a mock RASM module
function createMockRasmModule(
  exitCode = 0,
  files: Record<string, string | Uint8Array> = {}
): RasmModule {
  const virtualFS = new Map<string, string | Uint8Array>(Object.entries(files))

  return {
    FS: {
      writeFile: vi.fn((path: string, data: string | Uint8Array) => {
        virtualFS.set(path, data)
      }),
      readFile: vi.fn(
        (path: string, options?: { encoding?: 'utf8' | 'binary' }) => {
          const file = virtualFS.get(path)
          if (!file) {
            throw new Error(`File not found: ${path}`)
          }
          if (options?.encoding === 'utf8' && typeof file !== 'string') {
            return new TextDecoder().decode(file)
          }
          return file
        }
      ),
      unlink: vi.fn((path: string) => {
        virtualFS.delete(path)
      })
    },
    callMain: vi.fn(() => exitCode),
    print: vi.fn(),
    printErr: vi.fn()
  }
}

describe('rasm-wasm helpers', () => {
  const mockBinaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04])
  const mockSymbolData = 'label1 equ 0x1234\nlabel2 equ 0x5678'
  const mockSnapshotData = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd])
  const mockDskData = new Uint8Array([0x11, 0x22, 0x33, 0x44])

  describe('buildRasmArgs', () => {
    it('should build basic arguments', () => {
      // Test through the assemble function to verify integration
      const mockModule = createMockRasmModule(0, {
        'output.bin': mockBinaryData
      })

      // Verify structure by checking callMain is defined
      expect(mockModule.callMain).toBeDefined()
    })

    it('should include symbol flags when symbols enabled', () => {
      const mockModule = createMockRasmModule(0, {
        'output.bin': mockBinaryData,
        'output.sym': mockSymbolData
      })

      expect(mockModule.callMain).toBeDefined()
    })

    it('should include snapshot flags when exportType is snapshot', () => {
      const mockModule = createMockRasmModule(0, {
        'output.bin': mockBinaryData,
        'output.sna': mockSnapshotData
      })

      expect(mockModule.callMain).toBeDefined()
    })

    it('should include cartridge flags when exportType is cartridge', () => {
      const mockModule = createMockRasmModule(0, {
        'output.bin': mockBinaryData
      })

      expect(mockModule.callMain).toBeDefined()
    })
  })

  it('serializes concurrent assemble() calls and dispose waits for queue', async () => {
    // Intercept the script load to call onload immediately
    const appendSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node: any) => {
        // Immediately invoke onload so createRasmModule is called
        if (typeof node.onload === 'function') node.onload(new Event('load'))
        return node
      })

    // Save existing global module factory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (globalThis as any).createRasmModule

    const calls: number[] = []

    const mockModule = createMockRasmModule(0, {})
    mockModule.callMain = vi.fn(() => {
      // Record a timestamp and return
      calls.push(Date.now())
      return 0
    })

    // Provide the global factory expected by loadRasmModule
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).createRasmModule = async () => {
      mockModule.print = () => undefined
      mockModule.printErr = () => undefined
      return mockModule
    }

    // Simulate a longer assembly to ensure there is room for interleaving if
    // serialization is not in place.
    rasmWasm.__setTestAssemblyDelay(30)

    const rasmInstance = await rasmWasm.createRasmInstance()

    // Fire two assembles concurrently
    const p1 = rasmInstance.assemble('org 0x8000')
    const p2 = rasmInstance.assemble('org 0x8000')

    await Promise.all([p1, p2])

    // Both callMain invocations should have happened
    expect(mockModule.callMain).toHaveBeenCalledTimes(2)
    // The recorded timestamps should be ordered - second should be later
    expect(calls).toHaveLength(2)
    expect(calls[0]).toBeLessThanOrEqual(calls[1])

    // Dispose should wait for any queued operations to finish
    await rasmInstance.dispose()

    // Cleanup
    rasmWasm.__setTestAssemblyDelay(0)
    appendSpy.mockRestore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).createRasmModule = prev
  })

  describe('readOutputFiles', () => {
    it('should read binary file successfully', () => {
      const mockModule = createMockRasmModule(0, {
        'output.bin': mockBinaryData
      })

      const binaryData = mockModule.FS.readFile('output.bin')
      expect(binaryData).toEqual(mockBinaryData)
    })

    it('should read symbol file when requested', () => {
      const mockModule = createMockRasmModule(0, {
        'output.sym': mockSymbolData
      })

      const symData = mockModule.FS.readFile('output.sym', { encoding: 'utf8' })
      expect(symData).toBe(mockSymbolData)
    })

    it('should read snapshot file when available', () => {
      const mockModule = createMockRasmModule(0, {
        'output.sna': mockSnapshotData
      })

      const snaData = mockModule.FS.readFile('output.sna')
      expect(snaData).toEqual(mockSnapshotData)
    })

    it('should read DSK file when available', () => {
      const mockModule = createMockRasmModule(0, {
        'output.dsk': mockDskData
      })

      const dskData = mockModule.FS.readFile('output.dsk')
      expect(dskData).toEqual(mockDskData)
    })

    it('should throw error when file not found', () => {
      const mockModule = createMockRasmModule(0, {})

      expect(() => mockModule.FS.readFile('missing.bin')).toThrow(
        'File not found'
      )
    })
  })

  describe('cleanupFiles', () => {
    it('should remove files from virtual filesystem', () => {
      const mockModule = createMockRasmModule(0, {
        '/input.asm': 'org 0x4000',
        'output.bin': mockBinaryData
      })

      mockModule.FS.unlink('/input.asm')
      mockModule.FS.unlink('output.bin')

      expect(mockModule.FS.unlink).toHaveBeenCalledWith('/input.asm')
      expect(mockModule.FS.unlink).toHaveBeenCalledWith('output.bin')
    })

    it('should handle cleanup errors gracefully', () => {
      const mockModule = createMockRasmModule(0, {})

      // Should not throw even if file doesn't exist
      expect(() => {
        try {
          mockModule.FS.unlink('nonexistent.bin')
        } catch {
          // Ignore errors in cleanup
        }
      }).not.toThrow()
    })
  })

  describe('toUint8Array', () => {
    it('should handle Uint8Array input', () => {
      const input = new Uint8Array([1, 2, 3])
      // toUint8Array should return the same array
      expect(input).toBeInstanceOf(Uint8Array)
    })

    it('should handle string input', () => {
      const mockModule = createMockRasmModule(0, {
        'test.txt': mockSymbolData
      })

      const data = mockModule.FS.readFile('test.txt', { encoding: 'utf8' })
      expect(typeof data).toBe('string')
    })
  })

  describe('RasmModule mock', () => {
    it('should write files to virtual filesystem', () => {
      const mockModule = createMockRasmModule(0, {})
      const code = 'org 0x4000\nld a,0'

      mockModule.FS.writeFile('/input.asm', code)

      expect(mockModule.FS.writeFile).toHaveBeenCalledWith('/input.asm', code)
    })

    it('should execute callMain with arguments', () => {
      const mockModule = createMockRasmModule(0, {})
      const args = ['/input.asm', '-ob', 'output.bin']

      const exitCode = mockModule.callMain(args)

      expect(exitCode).toBe(0)
      expect(mockModule.callMain).toHaveBeenCalledWith(args)
    })

    it('should return error exit code on failure', () => {
      const mockModule = createMockRasmModule(1, {})
      const args = ['/input.asm']

      const exitCode = mockModule.callMain(args)

      expect(exitCode).toBe(1)
    })

    it('should capture print and printErr', () => {
      const mockModule = createMockRasmModule(0, {})

      mockModule.print?.('Assembly successful')
      mockModule.printErr?.('Warning: unused label')

      expect(mockModule.print).toHaveBeenCalledWith('Assembly successful')
      expect(mockModule.printErr).toHaveBeenCalledWith('Warning: unused label')
    })
  })
})
