# RASM WebAssembly Wrapper

Wrapper TypeScript pour RASM (Z80 assembler) compilé en WebAssembly avec Emscripten.

## Installation

Les fichiers WASM sont générés via le script de build :

```bash
./scripts/build-rasm-wasm.sh
```

Cela clone RASM v2.3.9, compile avec Emscripten et copie les artefacts dans `public/wasm/`.

## Usage

### Basic Assembly

```typescript
import { assemble } from '@/libs/rasm-wasm';

const code = `
  org #8000
  start:
    ld a,#42
    ret
`;

const result = await assemble(code);

if (result.success && result.binary) {
  console.log('Binary:', result.binary);
} else {
  console.error('Error:', result.output);
}
```

### With Symbols

```typescript
const result = await assemble(code, {
  symbols: true,
  symbolFile: 'output.sym'
});

if (result.success && result.symbols) {
  console.log('Symbols:', result.symbols);
}
```

### Create SNA Snapshot

```typescript
const result = await assemble(code, {
  exportType: 'snapshot',
  snapshotFile: 'program.sna'
});

if (result.success && result.snapshot) {
  // Download the snapshot
  const blob = new Blob([result.snapshot]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'program.sna';
  a.click();
}
```

### Create DSK Disk Image

```typescript
const result = await assemble(code, {
  exportType: 'dsk',
  dskFile: 'disk.dsk'
});

if (result.success && result.dsk) {
  // Download the DSK
  const blob = new Blob([result.dsk]);
  // ... download logic
}
```

## API

### `assemble(code: string, options?: AssembleOptions): Promise<AssembleResult>`

Assemble Z80 code.

#### Options

- `outputFile?: string` - Output binary filename (default: 'output.bin')
- `symbols?: boolean` - Generate symbol file (default: false)
- `symbolFile?: string` - Symbol file name (default: 'output.sym')
- `maxPass?: number` - Maximum number of passes (default: 80)
- `exportType?: 'snapshot' | 'cartridge' | 'dsk'` - Export format
- `snapshotFile?: string` - Snapshot filename (default: 'output.sna')
- `dskFile?: string` - DSK filename (default: 'output.dsk')

#### Result

```typescript
{
  success: boolean;
  binary?: Uint8Array;      // Assembled binary
  symbols?: string;          // Symbol table
  snapshot?: Uint8Array;     // SNA file
  dsk?: Uint8Array;          // DSK file
  output: string;            // RASM output (logs, errors)
  exitCode: number;          // RASM exit code
}
```

### `createRasmInstance(): Promise<RasmInstance>`

Create a reusable RASM instance.

```typescript
const rasm = await createRasmInstance();

// Use it multiple times
const result1 = await rasm.assemble(code1);
const result2 = await rasm.assemble(code2);

// Cleanup
rasm.dispose();
```

## Features

- ✅ Full Z80 assembly support
- ✅ Symbol table generation
- ✅ SNA snapshot creation
- ✅ DSK disk image creation
- ✅ Compression support (ZX0, apultra, lzsa)
- ✅ In-browser execution (no server needed)
- ✅ TypeScript types included

## License

- RASM: MIT License (Edouard BERGE)
- This wrapper: Same as parent project

## Build from Source

Requirements:
- Emscripten SDK (emsdk)

```bash
# Install emsdk
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Build RASM WASM
cd /path/to/pixsaur
./scripts/build-rasm-wasm.sh
```

The script will:
1. Clone RASM v2.3.9
2. Compile with all compression libraries
3. Copy artifacts to `public/wasm/`
4. Add license file
