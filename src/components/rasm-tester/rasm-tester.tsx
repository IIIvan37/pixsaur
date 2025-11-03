import { type ChangeEvent, useState } from 'react'
import Button from '@/components/ui/button/button'
import { Select, SelectItem } from '@/components/ui/select/select'
import { type AssembleResult, assemble } from '@/libs/rasm-wasm'
import styles from './rasm-tester.module.css'

const defaultCode = `org #8000
run $

start:
  ld a,#42
  ld b,#10
  call print_number
  ret

print_number:
  ; Print number in A
  add a,#30  ; Convert to ASCII
  call #bb5a ; TXT OUTPUT
  ret`

const exampleHelloWorld = `org #8000
run $

; Clear screen
ld a,1
call #bc0e

; Print message
ld hl,message
.loop:
  ld a,(hl)
  or a
  jr z,.done
  call #bb5a  ; TXT OUTPUT
  inc hl
  jr .loop

.done:
  ret

message:
  db "Hello, Amstrad CPC!",0`

const exampleAnimation = `org #8000
run $

; Colorful border animation
.loop:
  ld b,16
.color_loop:
  ld a,b
  out (#7f),a
  push bc
  ld bc,#ffff
.delay:
  dec bc
  ld a,b
  or c
  jr nz,.delay
  pop bc
  djnz .color_loop
  jr .loop`

export function RasmTester() {
  const [code, setCode] = useState(defaultCode)
  const [result, setResult] = useState<AssembleResult | null>(null)
  const [isAssembling, setIsAssembling] = useState(false)
  const [exportType, setExportType] = useState<'binary' | 'snapshot' | 'dsk'>(
    'binary'
  )
  const [withSymbols, setWithSymbols] = useState(false)
  const [activeTab, setActiveTab] = useState('output')

  const handleAssemble = async () => {
    console.log('[RasmTester] Assembly started')
    setIsAssembling(true)
    setResult(null)
    setActiveTab('output')

    try {
      const options =
        exportType === 'binary'
          ? { symbols: withSymbols }
          : {
              exportType:
                exportType === 'snapshot'
                  ? ('snapshot' as const)
                  : ('dsk' as const),
              symbols: withSymbols
            }

      console.log('[RasmTester] Calling assemble with options:', options)
      const assembleResult = await assemble(code, options)
      console.log('[RasmTester] Assembly result:', assembleResult)
      setResult(assembleResult)
    } catch (error) {
      console.error('[RasmTester] Assembly error:', error)
      setResult({
        success: false,
        output:
          error instanceof Error ? error.message : 'Unknown error occurred',
        exitCode: -1
      })
    } finally {
      setIsAssembling(false)
      console.log('[RasmTester] Assembly finished')
    }
  }

  const downloadBinary = (data: Uint8Array, filename: string) => {
    // Create an ArrayBuffer from the Uint8Array to avoid type issues
    const buffer = new ArrayBuffer(data.length)
    const view = new Uint8Array(buffer)
    view.set(data)

    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleExportTypeChange = (value: string) => {
    setExportType(value as 'binary' | 'snapshot' | 'dsk')
  }

  const handleCodeChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.title}>RASM WebAssembly Tester</h2>
          <p className={styles.description}>
            Test the RASM Z80 assembler running in WebAssembly
          </p>
        </div>

        <div className={styles.cardContent}>
          <div className={styles.section}>
            <label htmlFor='code' className={styles.label}>
              Z80 Assembly Code
            </label>
            <textarea
              id='code'
              value={code}
              onChange={handleCodeChange}
              className={styles.textarea}
              placeholder='Enter your Z80 assembly code here...'
            />
          </div>

          <div className={styles.controls}>
            <div className={styles.selectGroup}>
              <label htmlFor='export-type' className={styles.label}>
                Export Type
              </label>
              <Select value={exportType} onValueChange={handleExportTypeChange}>
                <SelectItem value='binary'>Binary (.bin)</SelectItem>
                <SelectItem value='snapshot'>Snapshot (.sna)</SelectItem>
                <SelectItem value='dsk'>Disk Image (.dsk)</SelectItem>
              </Select>
            </div>

            <div className={styles.checkboxGroup}>
              <input
                type='checkbox'
                id='symbols'
                checked={withSymbols}
                onChange={(e) => setWithSymbols(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor='symbols' className={styles.checkboxLabel}>
                Generate symbols
              </label>
            </div>

            <Button
              onClick={handleAssemble}
              disabled={isAssembling || !code.trim()}
              className={styles.assembleButton}
            >
              {isAssembling ? 'Assembling...' : 'Assemble'}
            </Button>
          </div>

          {result && (
            <div
              className={
                result.success ? styles.alertSuccess : styles.alertError
              }
            >
              <div className={styles.alertTitle}>
                {result.success
                  ? '✓ Assembly successful!'
                  : '✗ Assembly failed'}
              </div>
              <div className={styles.alertDescription}>
                Exit code: {result.exitCode}
              </div>
            </div>
          )}

          {result && (
            <div className={styles.tabs}>
              <div className={styles.tabsList}>
                <button
                  type='button'
                  className={
                    activeTab === 'output'
                      ? styles.tabActive
                      : styles.tabInactive
                  }
                  onClick={() => setActiveTab('output')}
                >
                  Output
                </button>
                {result.binary && (
                  <button
                    type='button'
                    className={
                      activeTab === 'binary'
                        ? styles.tabActive
                        : styles.tabInactive
                    }
                    onClick={() => setActiveTab('binary')}
                  >
                    Binary
                  </button>
                )}
                {result.symbols && (
                  <button
                    type='button'
                    className={
                      activeTab === 'symbols'
                        ? styles.tabActive
                        : styles.tabInactive
                    }
                    onClick={() => setActiveTab('symbols')}
                  >
                    Symbols
                  </button>
                )}
                {result.snapshot && (
                  <button
                    type='button'
                    className={
                      activeTab === 'snapshot'
                        ? styles.tabActive
                        : styles.tabInactive
                    }
                    onClick={() => setActiveTab('snapshot')}
                  >
                    Snapshot
                  </button>
                )}
                {result.dsk && (
                  <button
                    type='button'
                    className={
                      activeTab === 'dsk'
                        ? styles.tabActive
                        : styles.tabInactive
                    }
                    onClick={() => setActiveTab('dsk')}
                  >
                    DSK
                  </button>
                )}
              </div>

              <div className={styles.tabContent}>
                {activeTab === 'output' && (
                  <pre className={styles.output}>
                    {result.output || 'No output'}
                  </pre>
                )}

                {activeTab === 'binary' && result.binary && (
                  <div>
                    <div className={styles.downloadHeader}>
                      <p>Size: {result.binary.length} bytes</p>
                      <Button
                        onClick={() =>
                          downloadBinary(result.binary!, 'output.bin')
                        }
                        variant='secondary'
                      >
                        Download Binary
                      </Button>
                    </div>
                    <pre className={styles.output}>
                      {Array.from(result.binary)
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join(' ')}
                    </pre>
                  </div>
                )}

                {activeTab === 'symbols' && result.symbols && (
                  <div>
                    <div className={styles.downloadHeader}>
                      <Button
                        onClick={() =>
                          downloadText(result.symbols!, 'output.sym')
                        }
                        variant='secondary'
                      >
                        Download Symbols
                      </Button>
                    </div>
                    <pre className={styles.output}>{result.symbols}</pre>
                  </div>
                )}

                {activeTab === 'snapshot' && result.snapshot && (
                  <div>
                    <div className={styles.downloadHeader}>
                      <p>Snapshot size: {result.snapshot.length} bytes</p>
                      <Button
                        onClick={() =>
                          downloadBinary(result.snapshot!, 'output.sna')
                        }
                        variant='secondary'
                      >
                        Download Snapshot
                      </Button>
                    </div>
                    <p className={styles.info}>
                      The .sna file can be loaded in CPC emulators like JavaCPC,
                      WinAPE, or RetroVirtualMachine.
                    </p>
                  </div>
                )}

                {activeTab === 'dsk' && result.dsk && (
                  <div>
                    <div className={styles.downloadHeader}>
                      <p>DSK size: {result.dsk.length} bytes</p>
                      <Button
                        onClick={() =>
                          downloadBinary(result.dsk!, 'output.dsk')
                        }
                        variant='secondary'
                      >
                        Download DSK
                      </Button>
                    </div>
                    <p className={styles.info}>
                      The .dsk file can be used with CPC emulators as a floppy
                      disk image.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.title}>Examples</h2>
          <p className={styles.description}>Click to load an example</p>
        </div>

        <div className={styles.cardContent}>
          <div className={styles.examples}>
            <Button
              variant='secondary'
              onClick={() => setCode(defaultCode)}
              className={styles.exampleButton}
            >
              Simple Program
            </Button>
            <Button
              variant='secondary'
              onClick={() => setCode(exampleHelloWorld)}
              className={styles.exampleButton}
            >
              Hello World
            </Button>
            <Button
              variant='secondary'
              onClick={() => setCode(exampleAnimation)}
              className={styles.exampleButton}
            >
              Border Animation
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
