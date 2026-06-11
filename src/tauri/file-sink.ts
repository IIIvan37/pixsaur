import type { FileSink } from '@/export/application/ports'
import { saveZipFileTauri } from './export-tauri'

/**
 * Desktop adapter for {@link FileSink}: saves through the native Tauri file
 * dialog. Resolves `false` when the user dismisses the dialog.
 */
export const tauriFileSink: FileSink = {
  async save(blob, filename) {
    return saveZipFileTauri(blob, filename)
  }
}
