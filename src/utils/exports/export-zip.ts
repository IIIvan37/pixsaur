import JSZip from 'jszip'
import { toASMData } from './to-asm-data'
import { exportSCR } from './export-scr/export-scr'
import { injectPaletteDataIntoSCR } from '@/libs/cpc-palette'

export async function exportZip(
  indexBuf: Uint8Array,
  paletteFirmware: number[],
  canvas: HTMLCanvasElement,
  mode: 0 | 1 | 2,
  asmLabel = 'pixsaur_data'
) {
  const zip = new JSZip()

  const ctx = canvas.getContext('2d')
  const data = ctx?.getImageData(0, 0, canvas.width, canvas?.height)
  if (!data) return

  const scr = exportSCR(indexBuf, mode, canvas.width)

  injectPaletteDataIntoSCR(scr, paletteFirmware)
  const asmText = toASMData(scr, asmLabel)

  zip.file(`${asmLabel}.asm`, asmText)

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })
  zip.file('pixsaur.png', blob)

  // 5. Finalisation et téléchargement
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pixsaur-export.zip'
  a.click()
  URL.revokeObjectURL(url)
}
