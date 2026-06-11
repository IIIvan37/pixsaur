import {
  exportEgxToCpcPlayground,
  exportModeRToCpcPlayground,
  exportToCpcPlayground
} from '../../exports/exporters/export-cpc-playground'
import type { PlaygroundExporter } from '../ports'

/**
 * Adapter for {@link PlaygroundExporter}: wires the concrete CPC Playground
 * exporters. Serves web *and* desktop — each exporter resolves the
 * {@link import('../ports').PlaygroundPort} for the current runtime internally,
 * so no resolver is needed here.
 */
export const cpcPlaygroundExporter: PlaygroundExporter = {
  exportStandard: exportToCpcPlayground,
  exportModeR: exportModeRToCpcPlayground,
  exportEgx: exportEgxToCpcPlayground
}
