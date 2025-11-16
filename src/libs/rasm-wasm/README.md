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
import { assemble } from "@/libs/rasm-wasm";

const code = `
  org #8000
  start:
    ld a,#42
    ret
`;

const result = await assemble(code);

if (result.success && result.binary) {
  console.log("Binary:", result.binary);
} else {
  console.error("Error:", result.output);
}
```

### With Symbols

```typescript
const result = await assemble(code, {
  symbols: true,
  symbolFile: "output.sym",
});

if (result.success && result.symbols) {
  console.log("Symbols:", result.symbols);
}
```

### Create SNA Snapshot

```typescript
const result = await assemble(code, {
  exportType: "snapshot",
  snapshotFile: "program.sna",
});

if (result.success && result.snapshot) {
  // Download the snapshot
  const blob = new Blob([result.snapshot]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "program.sna";
  a.click();
}
```

### Create DSK Disk Image

```typescript
const result = await assemble(code, {
  exportType: "dsk",
  dskFile: "disk.dsk",
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
await rasm.dispose();

Note: assemble() calls are executed serially. The WebAssembly runtime modifies
global print handlers during assembly, so concurrent assemble() calls are
queued and executed one at a time to avoid race conditions. If you need
parallel assembly across workers, spawn multiple worker contexts instead of
calling assemble() simultaneously in the same main thread.
```

## DSK Manager

Advanced DSK disk image management with programmatic API.

### Create Empty DSK

```typescript
import { createRasmInstance, createDsk } from "@/libs/rasm-wasm";

const rasm = await createRasmInstance();
const module = rasm.getModule();

// Create empty DSK
const dskFilename = createDsk(module, {
  filename: "mydisk.dsk",
  format: "data", // or 'vendor'
});
```

### Add Files to DSK

```typescript
import { addFileToDsk } from "@/libs/rasm-wasm";

// Add a file to the DSK
addFileToDsk(
  module,
  "mydisk.dsk",
  {
    name: "SCREEN.BIN",
    data: screenData, // Uint8Array
    loadAddress: 0xc000,
  },
  {
    loadAddress: 0xc000,
    execAddress: 0xc000,
  }
);
```

### Create DSK with Multiple Files

```typescript
import { createDskWithFiles } from "@/libs/rasm-wasm";

const files = [
  {
    name: "SCREEN.BIN",
    data: new Uint8Array(16384).fill(0xaa),
    loadAddress: 0xc000,
  },
  {
    name: "CODE.BIN",
    data: codeData,
    loadAddress: 0x8000,
    execAddress: 0x8000,
  },
];

const dsk = await createDskWithFiles(module, files, {
  filename: "game.dsk",
  format: "data",
});

// Download the DSK
const blob = new Blob([new Uint8Array(dsk)]);
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "game.dsk";
a.click();
```

### Read and Delete DSK

```typescript
import { readDsk, deleteDsk } from "@/libs/rasm-wasm";

// Read DSK from virtual filesystem
const dsk = readDsk(module, "mydisk.dsk");

// Delete DSK from virtual filesystem
deleteDsk(module, "mydisk.dsk");
```

## Features

- ✅ Full Z80 assembly support
- ✅ Symbol table generation
- ✅ SNA snapshot creation
- ✅ DSK disk image creation
- ✅ **DSK Manager for programmatic disk creation**
- ✅ **Add multiple files to DSK**
- ✅ **Custom load/exec addresses**
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
