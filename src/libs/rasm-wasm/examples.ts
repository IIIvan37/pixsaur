/**
 * RASM WebAssembly Usage Examples
 */

import { createLogger } from '@/utils/logger'
import { assemble } from './index'

const rasmLogger = createLogger({ prefix: '[RASM]' })

/**
 * Example 1: Simple assembly
 */
export async function example1SimpleAssembly() {
  const code = `
    org #8000
    start:
      ld a,#42
      ret
  `

  const result = await assemble(code)

  if (result.success && result.binary) {
    rasmLogger.info('Assembly successful!')
    rasmLogger.info('Binary size:', result.binary.length, 'bytes')
    rasmLogger.info(
      'Binary:',
      Array.from(result.binary)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
    )
  } else {
    rasmLogger.error('Assembly failed:')
    rasmLogger.error(result.output)
  }

  return result
}

/**
 * Example 2: Assembly with symbols
 */
export async function example2WithSymbols() {
  const code = `
    org #8000
    start:
      ld hl,message
      call print
      ret
    
    message:
      db "Hello, CPC!",0
    
    print:
      ld a,(hl)
      or a
      ret z
      call #bb5a  ; TXT OUTPUT
      inc hl
      jr print
  `

  const result = await assemble(code, {
    symbols: true
  })

  if (result.success) {
    rasmLogger.info('Assembly successful!')
    if (result.symbols) {
      rasmLogger.info('\nSymbol table:')
      rasmLogger.info(result.symbols)
    }
  } else {
    rasmLogger.error('Assembly failed:')
    rasmLogger.error(result.output)
  }

  return result
}

/**
 * Example 3: Create SNA snapshot
 */
export async function example3CreateSnapshot() {
  const code = `
    org #8000
    run $
    
    ld a,1        ; Border color
    out (#7f),a   ; Set border
    
    .loop
      halt
      jr .loop
  `

  const result = await assemble(code, {
    exportType: 'snapshot',
    snapshotFile: 'program.sna'
  })

  if (result.success && result.snapshot) {
    rasmLogger.info('Snapshot created!')
    rasmLogger.info('Snapshot size:', result.snapshot.length, 'bytes')

    // Download the snapshot
    const blob = new Blob([result.snapshot], {
      type: 'application/octet-stream'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'program.sna'
    a.click()
    URL.revokeObjectURL(url)
  } else {
    rasmLogger.error('Snapshot creation failed:')
    rasmLogger.error(result.output)
  }

  return result
}

/**
 * Example 4: Create DSK disk image
 */
export async function example4CreateDisk() {
  const code = `
    org #8000
    
    save "PROGRAM.BIN",#8000,end-#8000,DSK,"disk.dsk"
    
    start:
      ld hl,#c000
      ld de,#c001
      ld bc,#3fff
      ld (hl),#aa
      ldir
      ret
    
    end:
  `

  const result = await assemble(code, {
    exportType: 'dsk',
    dskFile: 'disk.dsk'
  })

  if (result.success && result.dsk) {
    rasmLogger.info('DSK created!')
    rasmLogger.info('DSK size:', result.dsk.length, 'bytes')

    // Download the DSK
    const blob = new Blob([result.dsk], {
      type: 'application/octet-stream'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'disk.dsk'
    a.click()
    URL.revokeObjectURL(url)
  } else {
    rasmLogger.error('DSK creation failed:')
    rasmLogger.error(result.output)
  }

  return result
}

/**
 * Example 5: Create DSK with multiple files using DSK Manager
 */
export async function example5DskManager() {
  const { createRasmInstance, createDskWithFiles } = await import('./index')

  // Create RASM instance
  const rasm = await createRasmInstance()
  const module = rasm.getModule()

  // Create some example files
  const files = [
    {
      name: 'SCREEN.BIN',
      data: new Uint8Array(16384).fill(0xaa), // Fill screen with pattern
      loadAddress: 0xc000
    },
    {
      name: 'CODE.BIN',
      data: new Uint8Array([
        0x3e,
        0x01, // ld a,1
        0xd3,
        0x7f, // out (#7f),a
        0x76, // halt
        0xc9 // ret
      ]),
      loadAddress: 0x8000,
      execAddress: 0x8000
    }
  ]

  try {
    // Create DSK with all files
    const dsk = await createDskWithFiles(module, files, {
      filename: 'mydisk.dsk',
      format: 'data'
    })

    rasmLogger.info('DSK created with multiple files!')
    rasmLogger.info('DSK size:', dsk.length, 'bytes')

    // Download the DSK
    const blob = new Blob([new Uint8Array(dsk)], {
      type: 'application/octet-stream'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mydisk.dsk'
    a.click()
    URL.revokeObjectURL(url)

    return { success: true, dsk }
  } catch (error) {
    rasmLogger.error('Failed to create DSK:', error)
    return { success: false, error }
  }
}
