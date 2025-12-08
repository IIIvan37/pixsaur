import { createCanvas, loadImage } from 'canvas'

async function analyzeImage() {
  const image = await loadImage('./assassin01384.png')
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data

  console.log(`Image dimensions: ${image.width}x${image.height}`)

  // Analyze middle section where torches appear
  const startLine = Math.floor(image.height * 0.35)
  const endLine = Math.floor(image.height * 0.65)

  console.log(
    `\nAnalyzing lines ${startLine} to ${endLine} (middle section with torches):`
  )

  // Function to convert RGB to HSV
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
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6
      } else {
        h = ((r - g) / delta + 4) / 6
      }
    }

    return [h * 360, s, v]
  }

  // First, find ALL very bright/saturated pixels (likely torches)
  const brightPixels = []
  for (let line = startLine; line < endLine; line++) {
    for (let x = 0; x < image.width; x++) {
      const idx = (line * image.width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      const [h, s, v] = rgbToHsv(r, g, b)

      // Look for BRIGHT, SATURATED pixels (torches/fire)
      // High value (brightness) and high saturation
      if (v > 0.6 && s > 0.4) {
        brightPixels.push({ line, x, rgb: [r, g, b], hsv: [h, s, v] })
      }
    }
  }

  console.log(
    `\nFound ${brightPixels.length} bright saturated pixels (potential torches)`
  )

  if (brightPixels.length > 0) {
    // Group by hue
    const hueGroups = new Map()
    for (const p of brightPixels) {
      const hueBucket = Math.round(p.hsv[0] / 10) * 10
      if (!hueGroups.has(hueBucket)) {
        hueGroups.set(hueBucket, [])
      }
      hueGroups.get(hueBucket).push(p)
    }

    console.log('\nBright pixels grouped by hue:')
    for (const [hue, pixels] of Array.from(hueGroups.entries()).sort(
      (a, b) => a[0] - b[0]
    )) {
      console.log(`  Hue ${hue}°: ${pixels.length} pixels`)
      if (pixels.length > 0 && pixels.length < 150) {
        // Show a few samples
        console.log(
          `    Samples:`,
          pixels.slice(0, 3).map((p) => ({
            line: p.line,
            x: p.x,
            rgb: p.rgb,
            hsv: p.hsv.map((v) => v.toFixed(2))
          }))
        )
      }
    }
  }

  // Analyze a few specific lines in detail
  for (let line = startLine; line < Math.min(startLine + 10, endLine); line++) {
    const colorCounts = new Map()
    const hueGroups = new Map() // Group by hue ranges

    for (let x = 0; x < image.width; x++) {
      const idx = (line * image.width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      const key = `${r},${g},${b}`
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1)

      const [h, s, v] = rgbToHsv(r, g, b)

      // Only track saturated colors
      if (s > 0.2 && v > 0.2) {
        let hueRange
        if (h >= 330 || h < 30) hueRange = 'Red (0°)'
        else if (h >= 30 && h < 90) hueRange = 'Yellow (60°)'
        else if (h >= 90 && h < 150) hueRange = 'Green (120°)'
        else if (h >= 150 && h < 210) hueRange = 'Cyan (180°)'
        else if (h >= 210 && h < 270) hueRange = 'Blue (240°)'
        else hueRange = 'Magenta (300°)'

        hueGroups.set(hueRange, (hueGroups.get(hueRange) || 0) + 1)
      }
    }

    // Find red pixels
    const redPixels = []
    for (let x = 0; x < image.width; x++) {
      const idx = (line * image.width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const [h, s, v] = rgbToHsv(r, g, b)

      // Red hue is 0° (or 330-360°)
      if ((h >= 330 || h < 30) && s > 0.3 && v > 0.3) {
        redPixels.push({
          x,
          rgb: [r, g, b],
          hsv: [h.toFixed(1), s.toFixed(2), v.toFixed(2)]
        })
      }
    }

    console.log(`\nLine ${line}:`)
    console.log(`  Total unique colors: ${colorCounts.size}`)
    console.log(`  Hue distribution:`, Object.fromEntries(hueGroups))

    if (redPixels.length > 0) {
      console.log(`  RED PIXELS FOUND: ${redPixels.length} pixels`)
      console.log(`  Sample red pixels (first 5):`, redPixels.slice(0, 5))
    }
  }
}

analyzeImage().catch(console.error)
