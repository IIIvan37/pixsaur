/**
 * Use-case: export the DSK workspace as a ZIP bundle (disk image + README +
 * per-image binaries).
 *
 * Pure orchestration extracted from `handleExport` in
 * `components/dsk-workspace/dsk-workspace-panel.tsx`, which used to branch on
 * `isTauri()` and call `saveZipFileTauri` / `downloadFile` by hand — the third
 * caller of a save decision the {@link FileSink} port already owned. The UI now
 * assembles the input, injects the real ports, and maps the
 * {@link ExportDskWorkspaceToZipResult} to a notification.
 */

import type { DskImage } from '../exports/types'
import type { DskWorkspaceBuilder, FileSink } from './ports'

/** Filename offered for the workspace bundle (web download / save dialog). */
export const DSK_WORKSPACE_ZIP_FILENAME = 'pixsaur-workspace.zip'

export interface ExportDskWorkspaceToZipInput {
  /** The workspace images, in disk order. */
  images: DskImage[]
}

export interface ExportDskWorkspaceToZipDeps {
  dskWorkspaceBuilder: DskWorkspaceBuilder
  fileSink: FileSink
}

export type ExportDskWorkspaceToZipError =
  /** The workspace is empty — nothing to assemble. */
  | 'no-images'
  /** DSK assembly or zipping failed; the builder already logged the cause. */
  | 'zip-generation-failed'
  /** The user dismissed the desktop save dialog. */
  | 'save-cancelled'

export type ExportDskWorkspaceToZipResult =
  | { ok: true }
  | { ok: false; error: ExportDskWorkspaceToZipError }

export async function exportDskWorkspaceToZip(
  input: ExportDskWorkspaceToZipInput,
  deps: ExportDskWorkspaceToZipDeps
): Promise<ExportDskWorkspaceToZipResult> {
  const { images } = input
  const { dskWorkspaceBuilder, fileSink } = deps

  if (images.length === 0) return { ok: false, error: 'no-images' }

  const blob = await dskWorkspaceBuilder.buildZip(images)
  if (!blob) return { ok: false, error: 'zip-generation-failed' }

  const saved = await fileSink.save(blob, DSK_WORKSPACE_ZIP_FILENAME)
  return saved ? { ok: true } : { ok: false, error: 'save-cancelled' }
}
