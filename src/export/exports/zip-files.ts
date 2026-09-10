/**
 * Packs several files into one ZIP.
 *
 * `FileSink` saves one blob per call. An export made of several files that
 * name each other (a Tiled map, its tileset, their image) goes out as one
 * archive, so the relative paths between them hold after extraction and the
 * desktop app opens a single save dialog.
 */

import JSZip from 'jszip'

export interface ArchiveEntry {
  /** Path inside the archive. */
  name: string
  content: Blob | string
}

export async function zipFiles(
  entries: readonly ArchiveEntry[]
): Promise<Blob> {
  const zip = new JSZip()
  for (const { name, content } of entries) {
    // Read as bytes first: JSZip reads a Blob through `FileReader`, which not
    // every runtime the tests use provides.
    zip.file(
      name,
      typeof content === 'string' ? content : await content.arrayBuffer()
    )
  }
  return zip.generateAsync({ type: 'blob' })
}
