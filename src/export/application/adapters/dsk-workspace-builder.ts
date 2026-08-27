import { exportDskWorkspaceZip } from '../../exports/exporters/export-dsk-workspace-zip'
import type { DskWorkspaceBuilder } from '../ports'

/**
 * Adapter for {@link DskWorkspaceBuilder}: wires the concrete DSK workspace ZIP
 * exporter. Serves web *and* desktop — the disk image is assembled in WASM in
 * both runtimes, so no resolver is needed here.
 */
export const dskWorkspaceBuilder: DskWorkspaceBuilder = {
  buildZip: exportDskWorkspaceZip
}
