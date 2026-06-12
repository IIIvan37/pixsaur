/**
 * Use-case: open the current image in CPC Playground (upload the generated ASM
 * and open the share URL).
 *
 * Pure orchestration extracted from `handleOpenInPlayground` in
 * `components/export-panel/export-panel.tsx`. The UI assembles the per-mode
 * snapshot from atoms, injects the real {@link PlaygroundExporter}, calls this
 * use-case, and maps the {@link OpenImageInPlaygroundResult} to a notification.
 *
 * Branches on render mode in priority order **Mode R → EGX → standard**
 * (matching the original handler). Palette conversion and raster-ASM generation
 * are pure and live here; the network upload + URL open arrive through the
 * injected {@link PlaygroundExporter} port.
 */

import type { CpcModeConfig } from '@/domain/cpc'
import type { EGXConfig } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCHardware } from '@/libs/types'
import { paletteToCPCPlusValues } from '../exports/cpc-plus-format'
import type {
  CpcPlaygroundExportResult,
  EgxCpcPlaygroundExportOptions
} from '../exports/exporters/export-cpc-playground'
import type {
  ModeRSnaExportOptions,
  SnaExportOptions
} from '../exports/exporters/export-sna'
import {
  generateClassicRasterASM,
  generatePlusRasterASM,
  rgbToFirmwareIndex
} from '../exports/raster-format'
import type { PlaygroundExporter } from './ports'

type RgbTriplet = [number, number, number]

/** Mode R export branch: dual frames + their RGB palettes. */
export interface ModeRPlaygroundSnapshot {
  indexBufferA: Uint8Array
  indexBufferB: Uint8Array
  paletteA: ReadonlyArray<ArrayLike<number>>
  paletteB: ReadonlyArray<ArrayLike<number>>
}

/** EGX export branch: index buffer + RGB palette already resolved by the UI. */
export interface EgxPlaygroundSnapshot {
  indexBuffer: Uint8Array
  palette: ReadonlyArray<ArrayLike<number>>
  width: number
  height: number
  config: EGXConfig
}

/** Standard (non-EGX, non-Mode-R) export branch, from `prepareExportData`. */
export interface StandardPlaygroundSnapshot {
  indexBuf: Uint8Array
  paletteFirmware: number[]
  palettePlus: number[]
  /** Present (non-empty) only when raster mode is enabled. */
  rasterChanges?: RasterChange[]
}

export interface OpenImageInPlaygroundInput {
  modeConfig: CpcModeConfig
  cpcHardware: CPCHardware
  /** Mode R snapshot when Mode R is enabled, else `null`. */
  modeR: ModeRPlaygroundSnapshot | null
  /** EGX snapshot when EGX is enabled, else `null`. */
  egx: EgxPlaygroundSnapshot | null
  /** Standard snapshot when neither Mode R nor EGX applies, else `null`. */
  standard: StandardPlaygroundSnapshot | null
}

export interface OpenImageInPlaygroundDeps {
  exporter: PlaygroundExporter
}

/** Which branch ran — lets the UI pick the matching (localized) message. */
export type PlaygroundMode = 'modeR' | 'egx' | 'standard'

export type OpenImageInPlaygroundResult =
  | { ok: true; mode: PlaygroundMode }
  | { ok: false; mode: PlaygroundMode | null; error: string }

function toRgbTriplet(colorData: ArrayLike<number>): RgbTriplet {
  return [colorData[0], colorData[1], colorData[2]]
}

function paletteToFirmware(
  palette: ReadonlyArray<ArrayLike<number>>
): number[] {
  return palette.map((c) => rgbToFirmwareIndex(c[0], c[1], c[2]))
}

function buildModeROptions(
  modeR: ModeRPlaygroundSnapshot,
  modeConfig: CpcModeConfig,
  hardware: CPCHardware
): ModeRSnaExportOptions {
  const isPlus = hardware === 'plus'
  return {
    indexBufA: modeR.indexBufferA,
    indexBufB: modeR.indexBufferB,
    modeConfig,
    hardware,
    paletteAFirmware: isPlus ? undefined : paletteToFirmware(modeR.paletteA),
    paletteBFirmware: isPlus ? undefined : paletteToFirmware(modeR.paletteB),
    paletteAPlus: isPlus
      ? paletteToCPCPlusValues(modeR.paletteA.map(toRgbTriplet))
      : undefined,
    paletteBPlus: isPlus
      ? paletteToCPCPlusValues(modeR.paletteB.map(toRgbTriplet))
      : undefined,
    filename: 'pixsaur_modeR'
  }
}

function buildEgxOptions(
  egx: EgxPlaygroundSnapshot,
  hardware: CPCHardware
): EgxCpcPlaygroundExportOptions {
  return {
    indexBuf: egx.indexBuffer,
    width: egx.width,
    height: egx.height,
    egxConfig: egx.config,
    paletteFirmware: paletteToFirmware(egx.palette),
    paletteRgb: egx.palette.map(toRgbTriplet),
    hardware,
    filename: 'pixsaur_egx'
  }
}

function buildStandardOptions(
  standard: StandardPlaygroundSnapshot,
  modeConfig: CpcModeConfig,
  hardware: CPCHardware
): SnaExportOptions {
  const { indexBuf, paletteFirmware, palettePlus, rasterChanges } = standard
  const hasRasters = !!rasterChanges && rasterChanges.length > 0

  let rasterAsm: string | undefined
  if (hasRasters) {
    rasterAsm =
      hardware === 'classic'
        ? generateClassicRasterASM(
            rasterChanges,
            modeConfig.height,
            paletteFirmware
          )
        : generatePlusRasterASM(rasterChanges, modeConfig.height, palettePlus)
  }

  return {
    indexBuf,
    modeConfig,
    hardware,
    paletteFirmware: hardware === 'classic' ? paletteFirmware : undefined,
    palettePlus: hardware === 'plus' ? palettePlus : undefined,
    rasterAsm,
    hasRasters,
    filename: 'pixsaur'
  }
}

function toResult(
  mode: PlaygroundMode,
  result: CpcPlaygroundExportResult
): OpenImageInPlaygroundResult {
  return result.success
    ? { ok: true, mode }
    : { ok: false, mode, error: result.error ?? 'Unknown error' }
}

export async function openImageInPlayground(
  input: OpenImageInPlaygroundInput,
  deps: OpenImageInPlaygroundDeps
): Promise<OpenImageInPlaygroundResult> {
  const { modeConfig, cpcHardware, modeR, egx, standard } = input
  const { exporter } = deps

  if (modeR) {
    const result = await exporter.exportModeR(
      buildModeROptions(modeR, modeConfig, cpcHardware)
    )
    return toResult('modeR', result)
  }

  if (egx) {
    const result = await exporter.exportEgx(buildEgxOptions(egx, cpcHardware))
    return toResult('egx', result)
  }

  if (standard) {
    const result = await exporter.exportStandard(
      buildStandardOptions(standard, modeConfig, cpcHardware)
    )
    return toResult('standard', result)
  }

  return { ok: false, mode: null, error: 'no-export-data' }
}
