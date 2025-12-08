import { createCanvas, loadImage } from 'canvas'

async function compareImages() {
  const source = await loadImage('./assassin01384.png')
  const preview = await loadImage('./preview.png')

  console.log('Source dimensions:', source.width, 'x', source.height)
  console.log('Preview dimensions:', preview.width, 'x', preview.height)

  const sourceCanvas = createCanvas(source.width, source.height)
  const sourceCtx = sourceCanvas.getContext('2d')
  sourceCtx.drawImage(source, 0, 0)
  const sourceData = sourceCtx.getImageData(0, 0, source.width, source.height)

  const previewCanvas = createCanvas(preview.width, preview.height)
  const previewCtx = previewCanvas.getContext('2d')
  previewCtx.drawImage(preview, 0, 0)
  const previewData = previewCtx.getImageData(
    0,
    0,
    preview.width,
    preview.height
  )

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

  // Check the torch area - line 100, around x=200-225
  console.log('\n=== TORCH AREA COMPARISON (Line 100, x=200-230) ===\n')

  const line = 100
  for (let x = 200; x <= 230; x++) {
    const sourceIdx = (line * source.width + x) * 4
    const previewIdx = (line * preview.width + x) * 4

    const sourceR = sourceData.data[sourceIdx]
    const sourceG = sourceData.data[sourceIdx + 1]
    const sourceB = sourceData.data[sourceIdx + 2]

    const previewR = previewData.data[previewIdx]
    const previewG = previewData.data[previewIdx + 1]
    const previewB = previewData.data[previewIdx + 2]

    const [sH, sS, sV] = rgbToHsv(sourceR, sourceG, sourceB)
    const [pH, pS, pV] = rgbToHsv(previewR, previewG, previewB)

    // Highlight bright/saturated source pixels (potential torches)
    if (sS > 0.6 && sV > 0.7) {
      console.log(`x=${x}:`)
      console.log(
        `  SOURCE:  RGB(${sourceR.toString().padStart(3)},${sourceG.toString().padStart(3)},${sourceB.toString().padStart(3)}) HSV(${sH.toFixed(1).padStart(5)}°, ${sS.toFixed(2)}, ${sV.toFixed(2)}) ← TORCH!`
      )
      console.log(
        `  PREVIEW: RGB(${previewR.toString().padStart(3)},${previewG.toString().padStart(3)},${previewB.toString().padStart(3)}) HSV(${pH.toFixed(1).padStart(5)}°, ${pS.toFixed(2)}, ${pV.toFixed(2)})`
      )
      console.log('')
    }
  }

  // Extract all unique colors from preview
  const previewColors = new Map()
  for (let i = 0; i < previewData.data.length; i += 4) {
    const r = previewData.data[i]
    const g = previewData.data[i + 1]
    const b = previewData.data[i + 2]
    const key = `${r},${g},${b}`
    previewColors.set(key, (previewColors.get(key) || 0) + 1)
  }

  console.log(`\n=== PREVIEW PALETTE ===`)
  console.log(`Total unique colors in preview: ${previewColors.size}\n`)

  const sortedPreviewColors = Array.from(previewColors.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      const [h, s, v] = rgbToHsv(r, g, b)
      return { r, g, b, h, s, v, count }
    })
    .sort((a, b) => b.count - a.count)

  console.log('Top 30 colors in preview:')
  for (let i = 0; i < 30 && i < sortedPreviewColors.length; i++) {
    const c = sortedPreviewColors[i]
    const vibrant = c.s > 0.6 && c.v > 0.7 ? ' ← VIBRANT!' : ''
    const red = (c.h < 30 || c.h > 330) && c.s > 0.5 ? ' ← RED/ORANGE!' : ''
    console.log(
      `${(i + 1).toString().padStart(2)}. RGB(${c.r.toString().padStart(3)},${c.g.toString().padStart(3)},${c.b.toString().padStart(3)}) HSV(${c.h.toFixed(1).padStart(5)}°, ${c.s.toFixed(2)}, ${c.v.toFixed(2)}) - ${c.count.toString().padStart(6)} px${vibrant}${red}`
    )
  }
}

compareImages().catch(console.error)
