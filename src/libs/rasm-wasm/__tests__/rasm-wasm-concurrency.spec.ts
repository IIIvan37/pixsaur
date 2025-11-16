import { describe, expect, it } from 'vitest'
import { __setTestAssemblyDelay, createRasmInstance } from '../rasm-wasm'

describe('rasm-wasm concurrency', () => {
  it('serializes concurrent assemble() calls and dispose waits for queue', async () => {
    // Prepare fake Emscripten module
    const storage: Record<string, Uint8Array> = {}
    const writeTimestamps: number[] = []

    const fakeModule: any = {
      FS: {
        writeFile: (_path: string, data: string | Uint8Array) => {
          writeTimestamps.push(Date.now())
          storage[_path] =
            typeof data === 'string' ? new TextEncoder().encode(data) : data
        },
        readFile: (_path: string) => {
          // return a small buffer for outputs
          return new Uint8Array([1, 2, 3])
        },
        unlink: () => {}
      },
      callMain: (_args: string[]) => {
        // no-op synchronous success
        return 0
      },
      print: undefined,
      printErr: undefined
    }

    // Stub createRasmModule and force script onload to call immediately
    // add global stub
    ;(globalThis as any).createRasmModule = async (_opts: any) => {
      return fakeModule
    }

    const originalAppend = (document.head as any).appendChild
    // When script appended, immediately call onload
    ;(document.head as any).appendChild = (el: any) => {
      if (typeof el.onload === 'function') {
        el.onload()
      }
      return el
    }

    try {
      // Configure a test delay so assembly work is observable
      __setTestAssemblyDelay(80)

      const rasm = await createRasmInstance()

      // Start two assemblies concurrently
      const p1 = rasm.assemble('code 1')
      const p2 = rasm.assemble('code 2')

      // Wait for both to finish
      await Promise.all([p1, p2])

      // We should have two write events
      expect(writeTimestamps.length).toBe(2)

      // The second write should happen at least ~TEST_DELAY after the first
      const diff = writeTimestamps[1] - writeTimestamps[0]
      expect(diff).toBeGreaterThanOrEqual(70)

      // Now check dispose waits for queued jobs: start two long ops and call dispose()
      __setTestAssemblyDelay(80)
      const p3 = rasm.assemble('code 3')
      const p4 = rasm.assemble('code 4')

      let disposed = false
      const d = rasm.dispose().then(() => {
        disposed = true
      })

      // dispose should not resolve immediately while assemblies are pending
      expect(disposed).toBe(false)

      await Promise.all([p3, p4])
      await d

      expect(disposed).toBe(true)
    } finally {
      // restore DOM behavior
      ;(document.head as any).appendChild = originalAppend
      // clean test delay
      __setTestAssemblyDelay(0)
      delete (globalThis as any).createRasmModule
    }
  })
})
