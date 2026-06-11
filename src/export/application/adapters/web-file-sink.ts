import { downloadFile } from '../../download-file'
import type { FileSink } from '../ports'

/**
 * Web adapter for {@link FileSink}: triggers a browser download. The browser
 * has no cancellable save dialog, so the save always resolves `true`.
 */
export const webFileSink: FileSink = {
  async save(blob, filename) {
    downloadFile(blob, filename, 'application/zip')
    return true
  }
}
