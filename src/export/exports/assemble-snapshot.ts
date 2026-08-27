/**
 * Snapshot assembly — the one place that reaches for the RASM assembler to
 * turn a Z80 source into a CPC `.sna`.
 */

export interface SnapshotAssembly {
  /** The assembled snapshot, when RASM produced one. */
  snapshot?: Uint8Array
  /** Why the assembly produced nothing. */
  error?: string
}

/**
 * Assemble a Z80 source into a CPC snapshot.
 *
 * `filename` names the artifacts RASM emits (`<filename>.bin` /
 * `<filename>.sna`); it does not write anything to disk.
 */
export async function assembleSnapshot(
  asmSource: string,
  filename: string
): Promise<SnapshotAssembly> {
  const { createRasmInstance } = await import('@/libs/rasm-wasm')
  const rasmInstance = await createRasmInstance()

  const result = await rasmInstance.assemble(asmSource, {
    outputFile: `${filename}.bin`,
    exportType: 'snapshot',
    snapshotFile: `${filename}.sna`
  })

  if (!result.success) {
    return { error: `Assembly failed: ${result.output}` }
  }

  if (!result.snapshot) {
    return { error: 'No snapshot generated' }
  }

  return { snapshot: result.snapshot }
}
