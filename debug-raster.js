import { createCanvas, loadImage } from 'canvas'

async function debugRaster() {
  const image = await loadImage('./assassin01384.png')
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data

  // Focus on line 100 where we know there are bright red torches
  const line = 100

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

  // Collect all colors on this line
  const colorMap = new Map()
  for (let x = 0; x < image.width; x++) {
    const idx = (line * image.width + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const key = `${r},${g},${b}`

    if (!colorMap.has(key)) {
      colorMap.set(key, { r, g, b, count: 0, pixels: [] })
    }
    colorMap.get(key).count++
    colorMap.get(key).pixels.push(x)
  }

  console.log(
    `Line ${line}: ${colorMap.size} unique colors, ${image.width} pixels total\n`
  )

  // Find torch colors (bright, saturated, reddish)
  const torchColors = []
  for (const [key, data] of colorMap.entries()) {
    const [h, s, v] = rgbToHsv(data.r, data.g, data.b)

    // Torch criteria: very bright (v>0.7), very saturated (s>0.6), reddish (h<30)
    if (v > 0.7 && s > 0.6 && (h < 30 || h > 330)) {
      torchColors.push({
        rgb: [data.r, data.g, data.b],
        hsv: [h.toFixed(1), s.toFixed(2), v.toFixed(2)],
        count: data.count,
        pixels: data.pixels
      })
    }
  }

  torchColors.sort((a, b) => b.count - a.count)

  console.log(`Found ${torchColors.length} torch colors:`)
  for (const tc of torchColors) {
    console.log(
      `  RGB(${tc.rgb.join(',').padEnd(15)}) HSV(${tc.hsv.join(',').padEnd(20)}) - ${tc.count} pixels at positions:`,
      tc.pixels.slice(0, 10)
    )
  }

  // Now find the most common colors
  const allColors = Array.from(colorMap.values())
    .map((c) => ({
      rgb: [c.r, c.g, c.b],
      hsv: rgbToHsv(c.r, c.g, c.b),
      count: c.count
    }))
    .sort((a, b) => b.count - a.count)

  console.log(`\nTop 20 most frequent colors on this line:`)
  for (let i = 0; i < 20 && i < allColors.length; i++) {
    const c = allColors[i]
    const [h, s, v] = c.hsv
    console.log(
      `  ${(i + 1).toString().padStart(2)}. RGB(${c.rgb.join(',').padEnd(15)}) HSV(${h.toFixed(1).padStart(5)}, ${s.toFixed(2)}, ${v.toFixed(2)}) - ${c.count.toString().padStart(3)} px`
    )
  }
}

debugRaster().catch(console.error)
