// Export data as ASM - returns single string for single file or array of chunks
export function toASMData(
  scr: Uint8Array,
  label = 'pixsaur_data'
): string | Array<{ filename: string; content: string }> {
  const CHUNK_SIZE = 16384 // 16KB chunks

  // If data is <= 16KB, export as single block
  if (scr.length <= CHUNK_SIZE) {
    return toASMDataSingle(scr, label)
  }

  // Otherwise, split into separate files
  return toASMDataChunkedFiles(scr, label, CHUNK_SIZE)
}

function toASMDataSingle(scr: Uint8Array, label: string): string {
  const lines: string[] = []
  lines.push(`${label}:`)

  for (let i = 0; i < scr.length; i += 16) {
    const slice = scr.slice(i, i + 16)
    const bytes = Array.from(slice).map((b) =>
      b.toString(16).padStart(2, '0').toUpperCase()
    )
    const formattedBytes = bytes.map((b) => `#${b}`).join(', ')
    lines.push(`  db ${formattedBytes}`)
  }

  return lines.join('\n')
}

function toASMDataChunkedFiles(
  scr: Uint8Array,
  baseLabel: string,
  chunkSize: number
): Array<{ filename: string; content: string }> {
  const chunks: Array<{ filename: string; content: string }> = []
  let chunkIndex = 0
  const totalChunks = Math.ceil(scr.length / chunkSize)

  for (let offset = 0; offset < scr.length; offset += chunkSize) {
    const chunkData = scr.slice(
      offset,
      Math.min(offset + chunkSize, scr.length)
    )
    const chunkLabel = `${baseLabel}_chunk_${chunkIndex}`
    const chunkComment = `; Chunk ${chunkIndex + 1}/${totalChunks} - Offset: ${offset} - Size: ${chunkData.length} bytes\n`
    const content = chunkComment + toASMDataSingle(chunkData, chunkLabel)

    chunks.push({
      filename: `${chunkLabel}.asm`,
      content
    })
    chunkIndex++
  }

  return chunks
}
