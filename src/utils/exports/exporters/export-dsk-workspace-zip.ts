import JSZip from 'jszip'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { generateDskReadme } from '../generate-dsk-readme'
import { generateDskReadmePdf } from '../generate-dsk-readme-pdf'
import { exportDskWorkspace } from './export-dsk-workspace'

/**
 * Export DSK workspace as a ZIP file containing the DSK and a README
 */
export async function exportDskWorkspaceZip(
  images: DskImage[]
): Promise<Blob | null> {
  if (images.length === 0) {
    console.warn('No images in workspace to export')
    return null
  }

  try {
    console.log('[DSK Workspace ZIP] Starting ZIP export')

    // Generate DSK file
    const dskData = await exportDskWorkspace(images)
    if (!dskData) {
      console.error('[DSK Workspace ZIP] Failed to generate DSK')
      return null
    }

    // Create ZIP
    const zip = new JSZip()
    const dskFilename = 'pixsaur-workspace.dsk'

    // Add DSK file to ZIP
    zip.file(dskFilename, dskData)
    console.log('[DSK Workspace ZIP] Added DSK to archive')

    // Generate and add README
    const readme = generateDskReadme(images, dskFilename)
    zip.file('README.md', readme)
    console.log('[DSK Workspace ZIP] Added README.md to archive')

    // Generate and add README PDF
    const readmePdf = generateDskReadmePdf(images, dskFilename)
    zip.file('README.pdf', readmePdf)
    console.log('[DSK Workspace ZIP] Added README.pdf to archive')

    // Add individual SCR files
    for (const image of images) {
      // scrData is already a complete SCR with palette injected
      const scrData = new Uint8Array(image.scrData)

      // Generate filename from image name (convert to AMSDOS format)
      const filename = image.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 8)

      zip.file(`${filename}.scr`, scrData)
      console.log(`[DSK Workspace ZIP] Added ${filename}.scr to archive`)
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })

    console.log('[DSK Workspace ZIP] ZIP export completed successfully')
    return zipBlob
  } catch (error) {
    console.error('[DSK Workspace ZIP] Error during ZIP export:', error)
    return null
  }
}
