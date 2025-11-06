/**
 * Download a Uint8Array or Blob as a file
 */
export function downloadFile(
  data: Uint8Array | Blob,
  filename: string,
  mimeType: string = 'application/octet-stream'
) {
  let blob: Blob

  if (data instanceof Blob) {
    // Data is already a Blob
    blob = data
  } else {
    // Create a new Uint8Array to ensure it's properly typed for Blob
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer
    blob = new Blob([arrayBuffer], { type: mimeType })
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
