import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/domain/cpc'
import { exportLinearAsm } from '../export-linear-asm/export-linear.asm'
import { toASMData } from '../to-asm-data'
import type { ExportConfig } from '../types'
import { getHeader } from './utils'

export async function exportLinearData(
  zip: JSZip,
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  config: ExportConfig,
  asmLabel: string,
  isCPCPlus: boolean
) {
  if (config.content.includeLinear) {
    const linear_asm = exportLinearAsm(indexBuf, modeConfig)
    const asmResult = toASMData(linear_asm, `${asmLabel}_linear`)

    if (typeof asmResult === 'string') {
      // Single file
      const linear_asm_text =
        getHeader(modeConfig, 'Linear', isCPCPlus) + asmResult
      zip.file(`${asmLabel}_linear.asm`, linear_asm_text)
    } else {
      // Multiple chunked files
      const header = getHeader(modeConfig, 'Linear', isCPCPlus)
      for (const chunk of asmResult) {
        zip.file(chunk.filename, header + chunk.content)
      }
    }
  }
}
