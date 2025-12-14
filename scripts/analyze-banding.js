import fs from 'node:fs'
import { PNG } from 'pngjs'

// Track a specific pixel position across lines to see how it changes
function trackPixels(filename, positions, startLine, endLine) {
  const data = fs.readFileSync(filename)
  const png = PNG.sync.read(data)
  const width = png.width
  const height = png.height
  const pixels = png.data

  console.log(
    '=== ' +
      filename +
      ' - tracking pixels at x=' +
      positions.join(', ') +
      ' ===\n'
  )

  for (let y = startLine; y <= Math.min(endLine, height - 1); y++) {
    const pixelColors = positions.map((x) => {
      const idx = (y * width + x) * 4
      return `${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]}`
    })

    const marker = y === 162 ? ' <== BANDE' : ''
    console.log(`Line ${y}: ${pixelColors.join(' | ')}${marker}`)
  }
}

// Track pixel x=0 (which goes dark at line 162)
trackPixels('preview-2.png', [0, 50, 100, 150, 200], 155, 170)

console.log('\n')

// Now compare with original preview (before new algo)
trackPixels('preview.png', [0, 50, 100, 150, 200], 155, 170)
