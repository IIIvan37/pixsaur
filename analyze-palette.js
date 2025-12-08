import { createCanvas, loadImage } from 'canvas'

async function analyzePalette() {
  const image = await loadImage('./assassin01384.png')
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data

  // Collect all colors in the entire image
  const colorCounts = new Map()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = `${r},${g},${b}`
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
  }

  // Sort by frequency
  const sortedColors = Array.from(colorCounts.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      return { r, g, b, count }
    })
    .sort((a, b) => b.count - a.count)

  console.log('Top 20 colors in the entire image:')
  console.log('(These would be in the global palette)\n')

  for (let i = 0; i < 20; i++) {
    const c = sortedColors[i]
    console.log(
      `${i + 1}. RGB(${c.r.toString().padStart(3)}, ${c.g.toString().padStart(3)}, ${c.b.toString().padStart(3)}) - ${c.count.toString().padStart(5)} pixels`
    )
  }

  console.log(`\nTotal unique colors in image: ${colorCounts.size}`)

  // Now check the torch area specifically
  const torchLine = 110
  const torchColors = new Map()

  for (let x = 0; x < image.width; x++) {
    const idx = (torchLine * image.width + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    // Check if it's in the red/orange range (hue 0-40°)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    if (delta > 20 && r >= g && r >= b && r > 80) {
      // Reddish/orange
      const key = `${r},${g},${b}`
      torchColors.set(key, (torchColors.get(key) || 0) + 1)
    }
  }

  console.log(`\n\nTorch colors on line ${torchLine}:`)
  const sortedTorchColors = Array.from(torchColors.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      return { r, g, b, count }
    })
    .sort((a, b) => b.count - a.count)

  for (const c of sortedTorchColors.slice(0, 10)) {
    console.log(
      `RGB(${c.r.toString().padStart(3)}, ${c.g.toString().padStart(3)}, ${c.b.toString().padStart(3)}) - ${c.count} pixels`
    )
  }
}

analyzePalette().catch(console.error)
