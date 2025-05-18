export function toASMData(scr: Uint8Array, label = 'pixsaur_data'): string {
  const lines: string[] = []
  lines.push(`${label}:`)

  for (let i = 0; i < scr.length; i += 16) {
    const slice = scr.slice(i, i + 16)
    const bytes = Array.from(slice).map((b) =>
      b.toString(16).padStart(2, '0').toUpperCase()
    )
    lines.push(`  db ${bytes.map((b) => `#${b}`).join(', ')}`)
  }

  return lines.join('\n')
}
