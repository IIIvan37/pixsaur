import { createCanvas, loadImage } from 'canvas'

async function findTorches() {
  const preview = await loadImage('./preview2.png')
  const canvas = createCanvas(preview.width, preview.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(preview, 0, 0)
  const data = ctx.getImageData(0, 0, preview.width, preview.height)

  function rgbToHsv(r, g, b) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min
    let h = 0
    const s = max === 0 ? 0 : delta / max
    const v = max
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / delta + 2) / 6
      else h = ((r - g) / delta + 4) / 6
    }
    return [h * 360, s, v]
  }

  // Find all torch pixels
  console.log('Looking for very vibrant red/orange pixels (torches)...\n')

  const torchPixels = []
  for (let y = 0; y < preview.height; y++) {
    for (let x = 0; x < preview.width; x++) {
      const idx = (y * preview.width + x) * 4
      const r = data.data[idx]
      const g = data.data[idx + 1]
      const b = data.data[idx + 2]
      const [h, s, v] = rgbToHsv(r, g, b)

      if ((h < 30 || h > 330) && s > 0.8 && v > 0.85) {
        torchPixels.push({ x, y, r, g, b, h, s, v })
      }
    }
  }

  console.log(
    `Found ${torchPixels.length} very bright torch pixels (s>0.8, v>0.85)\n`
  )

  // Group by line
  const byLine = new Map()
  for (const p of torchPixels) {
    if (!byLine.has(p.y)) {
      byLine.set(p.y, [])
    }
    byLine.get(p.y).push(p)
  }

  console.log('Torches by line:')
  const sortedLines = Array.from(byLine.entries()).sort((a, b) => a[0] - b[0])
  for (const [y, pixels] of sortedLines.slice(0, 20)) {
    console.log(
      `  Line ${y.toString().padStart(3)}: ${pixels.length.toString().padStart(2)} pixels at x=${pixels.map((p) => p.x).join(',')}`
    )
    if (pixels.length <= 5) {
      for (const p of pixels) {
        console.log(
          `    → RGB(${p.r},${p.g},${p.b}) HSV(${p.h.toFixed(1)}°, ${p.s.toFixed(2)}, ${p.v.toFixed(2)})`
        )
      }
    }
  }
}

findTorches().catch(console.error)
