import sharp from 'sharp'

async function analyzeImages() {
  // Charger les images
  const source = sharp('./source-3.jpg')
  const preview = sharp('./preview3-2.png')

  const srcMeta = await source.metadata()
  const prevMeta = await preview.metadata()

  console.log('=== SOURCE IMAGE ===')
  console.log('Dimensions:', srcMeta.width, 'x', srcMeta.height)

  // Extraire les pixels raw de la source
  const srcBuffer = await source.raw().toBuffer()
  const srcWidth = srcMeta.width
  const srcHeight = srcMeta.height
  const srcChannels = srcMeta.channels || 3

  // Analyser toutes les couleurs de la source
  console.log('\n=== SOURCE: TOUTES LES COULEURS ===')
  const srcAllColors = new Map()
  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const idx = (y * srcWidth + x) * srcChannels
      const r = srcBuffer[idx]
      const g = srcBuffer[idx + 1]
      const b = srcBuffer[idx + 2]
      const key = `${r},${g},${b}`
      srcAllColors.set(key, (srcAllColors.get(key) || 0) + 1)
    }
  }
  const srcSorted = Array.from(srcAllColors.entries()).sort(
    (a, b) => b[1] - a[1]
  )
  console.log(`Total unique colors in source: ${srcAllColors.size}`)
  console.log('Top 20 colors:')
  srcSorted.slice(0, 20).forEach(([c, n], i) => {
    const [r, g, b] = c.split(',').map(Number)
    console.log(`  ${i + 1}. rgb(${r},${g},${b}) - ${n} pixels`)
  })

  console.log('\n=== PREVIEW IMAGE ===')
  console.log('Dimensions:', prevMeta.width, 'x', prevMeta.height)

  // Extraire les pixels raw
  const prevBuffer = await preview.raw().toBuffer()
  const width = prevMeta.width
  const height = prevMeta.height
  const channels = prevMeta.channels || 3

  // Analyser toutes les couleurs de la preview
  console.log('\n=== PREVIEW: TOUTES LES COULEURS ===')
  const prevAllColors = new Map()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const r = prevBuffer[idx]
      const g = prevBuffer[idx + 1]
      const b = prevBuffer[idx + 2]
      const key = `${r},${g},${b}`
      prevAllColors.set(key, (prevAllColors.get(key) || 0) + 1)
    }
  }
  const prevSorted = Array.from(prevAllColors.entries()).sort(
    (a, b) => b[1] - a[1]
  )
  console.log(`Total unique colors in preview: ${prevAllColors.size}`)
  console.log('All colors:')
  prevSorted.forEach(([c, n], i) => {
    const [r, g, b] = c.split(',').map(Number)
    // Vérifier si cette couleur existe dans la source (ou proche)
    let closestInSource = null
    let closestDist = Infinity
    for (const [srcKey] of srcAllColors) {
      const [sr, sg, sb] = srcKey.split(',').map(Number)
      const dist = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2
      if (dist < closestDist) {
        closestDist = dist
        closestInSource = srcKey
      }
    }
    const isExact = srcAllColors.has(c)
    const distStr = isExact
      ? 'EXACT'
      : `closest: ${closestInSource} (dist=${Math.sqrt(closestDist).toFixed(1)})`
    console.log(`  ${i + 1}. rgb(${r},${g},${b}) - ${n} pixels - ${distStr}`)
  })

  // Analyser les changements de palette par ligne
  console.log('\n=== PREVIEW: CHANGEMENTS DE PALETTE PAR LIGNE ===')
  let lastPalette = null
  let paletteChanges = 0
  for (let line = 0; line < height; line++) {
    const colors = new Set()
    for (let x = 0; x < width; x++) {
      const idx = (line * width + x) * channels
      const r = prevBuffer[idx]
      const g = prevBuffer[idx + 1]
      const b = prevBuffer[idx + 2]
      colors.add(`${r},${g},${b}`)
    }
    const paletteKey = Array.from(colors).sort().join('|')
    if (paletteKey !== lastPalette) {
      if (lastPalette !== null) {
        paletteChanges++
        console.log(
          `Line ${line}: palette changed to [${Array.from(colors).join(', ')}]`
        )
      }
      lastPalette = paletteKey
    }
  }
  console.log(`\nTotal palette changes: ${paletteChanges}`)
}

analyzeImages().catch(console.error)
