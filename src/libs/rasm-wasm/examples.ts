/**
 * RASM WebAssembly Usage Examples
 */

import { assemble } from './index'

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
    console.log('Assembly successful!')
    console.log('Binary size:', result.binary.length, 'bytes')
    console.log(
      'Binary:',
      Array.from(result.binary)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
    )
  } else {
    console.error('Assembly failed:')
    console.error(result.output)
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
    console.log('Assembly successful!')
    if (result.symbols) {
      console.log('\nSymbol table:')
      console.log(result.symbols)
    }
  } else {
    console.error('Assembly failed:')
    console.error(result.output)
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
    console.log('Snapshot created!')
    console.log('Snapshot size:', result.snapshot.length, 'bytes')

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
    console.error('Snapshot creation failed:')
    console.error(result.output)
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
    console.log('DSK created!')
    console.log('DSK size:', result.dsk.length, 'bytes')

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
    console.error('DSK creation failed:')
    console.error(result.output)
  }

  return result
}
