/**
 * The project as a file the user owns (Q31).
 *
 * The workshop already remembers itself in the browser (`TilesetProjectStore`);
 * this is the copy that survives a cleared cache, another machine, or a
 * hand-off. Both directions are use-cases rather than click handlers: the name
 * of the file, the JSON media type and the refusals are decisions, and a
 * decision written in JSX can only be tested by rendering a panel.
 *
 * The write goes through the `FileSink` port `src/export` already declares —
 * one path for web and desktop. The read needs no port: a `Blob` is a value the
 * browser hands over, and a fake is one line.
 */

import type { FileSink } from '@/export/application/ports'
import {
  type ParseTilesetProjectResult,
  parseTilesetProject,
  serializeTilesetProject,
  type TilesetProject
} from './tileset-project'

/** The name the workshop gives the file it hands over. */
export const TILESET_PROJECT_FILENAME = 'tileset-project.json'

export interface ExportTilesetProjectFileInput {
  project: TilesetProject
  /** Defaults to {@link TILESET_PROJECT_FILENAME}. */
  filename?: string
}

export interface ExportTilesetProjectFileDeps {
  fileSink: FileSink
}

export type ExportTilesetProjectFileResult =
  | { ok: true }
  | { ok: false; error: 'save-failed' }

export async function exportTilesetProjectFile(
  {
    project,
    filename = TILESET_PROJECT_FILENAME
  }: ExportTilesetProjectFileInput,
  { fileSink }: ExportTilesetProjectFileDeps
): Promise<ExportTilesetProjectFileResult> {
  const blob = new Blob([serializeTilesetProject(project)], {
    type: 'application/json'
  })

  try {
    // A cancelled save dialog is not a failure: the user said no, and there is
    // nothing for the caller to do differently.
    await fileSink.save(blob, filename)
    return { ok: true }
  } catch {
    return { ok: false, error: 'save-failed' }
  }
}

export interface ImportTilesetProjectFileInput {
  /** The file the user picked. */
  file: Blob
}

export type ImportTilesetProjectFileResult =
  | ParseTilesetProjectResult
  | { ok: false; error: 'unreadable-file' }

/**
 * The picked file as a project, or the reason it is refused.
 *
 * A refusal **names** what went wrong so the panel can say it: a file the
 * browser would not read is not the same accident as a project from another
 * version, and the user can act on the difference.
 */
export async function importTilesetProjectFile({
  file
}: ImportTilesetProjectFileInput): Promise<ImportTilesetProjectFileResult> {
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'unreadable-file' }
  }

  return parseTilesetProject(text)
}
