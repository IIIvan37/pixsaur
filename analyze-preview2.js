import { createCanvas, loadImage } from 'canvas'

async function analyzePreview2() {
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

  console.log('Preview2 dimensions:', preview.width, 'x', preview.height)

  // Check torch area - line 100
  const line = 100
  console.log('\n=== TORCH AREA (Line 100, x=200-230) ===\n')

  for (let x = 200; x <= 230; x++) {
    const idx = (line * preview.width + x) * 4
    const r = data.data[idx]
    const g = data.data[idx + 1]
    const b = data.data[idx + 2]
    const [h, s, v] = rgbToHsv(r, g, b)

    if (s > 0.6 && v > 0.7) {
      console.log(
        `x=${x}: RGB(${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}) HSV(${h.toFixed(1).padStart(5)}°, ${s.toFixed(2)}, ${v.toFixed(2)}) ← VIBRANT!`
      )
    }
  }

  // Count vibrant red/orange pixels in entire image
  const colors = new Map()
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]
    const g = data.data[i + 1]
    const b = data.data[i + 2]
    const [h, s, v] = rgbToHsv(r, g, b)

    if ((h < 30 || h > 330) && s > 0.7 && v > 0.7) {
      const key = `${r},${g},${b}`
      colors.set(key, (colors.get(key) || 0) + 1)
    }
  }

  const totalVibrant = Array.from(colors.values()).reduce((a, b) => a + b, 0)
  console.log(
    `\nVibrant red/orange pixels (h<30°, s>0.7, v>0.7): ${totalVibrant}`
  )

  if (colors.size > 0) {
    console.log('\nColors found:')
    const sorted = Array.from(colors.entries()).sort((a, b) => b[1] - a[1])
    for (const [key, count] of sorted) {
      const [r, g, b] = key.split(',').map(Number)
      const [h, s, v] = rgbToHsv(r, g, b)
      console.log(
        `  RGB(${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}) HSV(${h.toFixed(1).padStart(5)}°, ${s.toFixed(2)}, ${v.toFixed(2)}) - ${count.toString().padStart(5)} px`
      )
    }
  } else {
    console.log('NO VIBRANT RED/ORANGE PIXELS FOUND! ❌')
  }

  // Also check for moderately vibrant orange
  const moderateColors = new Map()
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]
    const g = data.data[i + 1]
    const b = data.data[i + 2]
    const [h, s, v] = rgbToHsv(r, g, b)

    if ((h < 40 || h > 330) && s > 0.5 && v > 0.6) {
      const key = `${r},${g},${b}`
      moderateColors.set(key, (moderateColors.get(key) || 0) + 1)
    }
  }

  const totalModerate = Array.from(moderateColors.values()).reduce(
    (a, b) => a + b,
    0
  )
  console.log(
    `\nModerately vibrant red/orange pixels (h<40°, s>0.5, v>0.6): ${totalModerate}`
  )
}

analyzePreview2().catch(console.error)
