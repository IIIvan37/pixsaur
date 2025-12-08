import fs from 'node:fs'
import { createCanvas, loadImage } from 'canvas'
import { PNG } from 'pngjs'

/**
 * Calcule la teinte (hue) d'une couleur (0-360)
 * Retourne -1 pour les couleurs achromatiques (gris)
 */
function calculateHue(r, g, b) {
  r = r / 255
  g = g / 255
  b = b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  // Couleur achromatique (gris)
  if (delta < 0.01) return -1

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  hue *= 60
  if (hue < 0) hue += 360

  return Math.round(hue)
}

/**
 * Calcule la saturation d'une couleur (0-1)
 */
function calculateSaturation(r, g, b) {
  r = r / 255
  g = g / 255
  b = b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max > 0 ? (max - min) / max : 0
}

async function analyzeImage(imagePath) {
  console.log(`\n📊 Analyzing: ${imagePath}\n`)

  // Charger l'image
  const img = await loadImage(imagePath)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  const { data, width, height } = imageData

  // Analyser toutes les couleurs de l'image
  const colorMap = new Map() // key: "r,g,b" -> count
  const hueMap = new Map() // key: hue bucket (0-35 = 10° buckets) -> colors

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const key = `${r},${g},${b}`

      colorMap.set(key, (colorMap.get(key) || 0) + 1)

      const hue = calculateHue(r, g, b)
      const sat = calculateSaturation(r, g, b)

      // Grouper par teinte (buckets de 10°)
      if (sat > 0.2 && hue >= 0) {
        const hueBucket = Math.floor(hue / 10)
        if (!hueMap.has(hueBucket)) {
          hueMap.set(hueBucket, [])
        }
        hueMap.get(hueBucket).push({ r, g, b, count: 1 })
      }
    }
  }

  console.log(`Total unique colors: ${colorMap.size}`)
  console.log(`Total pixels: ${width * height}`)

  // Afficher les top couleurs par fréquence
  const sortedColors = Array.from(colorMap.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      const hue = calculateHue(r, g, b)
      const sat = calculateSaturation(r, g, b)
      return { r, g, b, count, hue, sat }
    })
    .sort((a, b) => b.count - a.count)

  console.log('\n🎨 Top 20 most frequent colors:')
  for (let i = 0; i < Math.min(20, sortedColors.length); i++) {
    const { r, g, b, count, hue, sat } = sortedColors[i]
    const percent = ((count / (width * height)) * 100).toFixed(2)
    const hueStr = hue >= 0 ? `${hue}°` : 'gray'
    console.log(
      `  ${i + 1}. rgb(${r}, ${g}, ${b}) - ${percent}% (hue: ${hueStr}, sat: ${sat.toFixed(2)})`
    )
  }

  // Analyser la distribution des teintes
  console.log('\n🌈 Hue distribution (10° buckets with saturation > 0.2):')
  const sortedHues = Array.from(hueMap.entries())
    .map(([bucket, colors]) => {
      const totalPixels = colors.reduce((sum, c) => sum + c.count, 0)
      const avgColor = {
        r: Math.round(colors.reduce((sum, c) => sum + c.r, 0) / colors.length),
        g: Math.round(colors.reduce((sum, c) => sum + c.g, 0) / colors.length),
        b: Math.round(colors.reduce((sum, c) => sum + c.b, 0) / colors.length)
      }
      return {
        hueBucket: bucket,
        hueRange: `${bucket * 10}-${(bucket + 1) * 10}°`,
        uniqueColors: colors.length,
        totalPixels,
        avgColor
      }
    })
    .sort((a, b) => b.uniqueColors - a.uniqueColors)

  for (const { hueRange, uniqueColors, totalPixels, avgColor } of sortedHues) {
    console.log(
      `  ${hueRange}: ${uniqueColors} unique colors, ~${totalPixels} pixels, avg: rgb(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`
    )
  }

  console.log('\n✅ Analysis complete!')
}

const imagePath = process.argv[2] || './image0.jpg'
analyzeImage(imagePath).catch(console.error)
