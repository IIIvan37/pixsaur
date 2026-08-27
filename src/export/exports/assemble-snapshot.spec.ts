import { assembleSnapshot } from './assemble-snapshot'

const assemble = vi.fn()

vi.mock('@/libs/rasm-wasm', () => ({
  createRasmInstance: () =>
    Promise.resolve({ assemble: (...args: unknown[]) => assemble(...args) })
}))

beforeEach(() => {
  assemble.mockReset()
})

describe('assembleSnapshot', () => {
  it('names the RASM artifacts after the filename', async () => {
    assemble.mockResolvedValue({ success: true, snapshot: new Uint8Array([1]) })

    await assembleSnapshot('org #4000', 'my_image')

    expect(assemble).toHaveBeenCalledWith('org #4000', {
      outputFile: 'my_image.bin',
      exportType: 'snapshot',
      snapshotFile: 'my_image.sna'
    })
  })

  it('returns the snapshot on success', async () => {
    const snapshot = new Uint8Array([1, 2, 3])
    assemble.mockResolvedValue({ success: true, snapshot })

    await expect(assembleSnapshot('src', 'f')).resolves.toEqual({ snapshot })
  })

  it('reports the assembler output when assembly fails', async () => {
    assemble.mockResolvedValue({ success: false, output: 'line 3: syntax' })

    await expect(assembleSnapshot('src', 'f')).resolves.toEqual({
      error: 'Assembly failed: line 3: syntax'
    })
  })

  it('reports a successful assembly that produced no snapshot', async () => {
    assemble.mockResolvedValue({ success: true })

    await expect(assembleSnapshot('src', 'f')).resolves.toEqual({
      error: 'No snapshot generated'
    })
  })
})
