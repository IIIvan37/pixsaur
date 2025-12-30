# Common ASM Utilities Documentation

This folder contains common Z80 assembly routines used across different CPC screen modes in Pixsaur.

## Table of Contents

- [overscan.asm](#overscanasm) - Overscan display routines
- [sync.asm](#syncasm) - VBL synchronization routines
- [classic.asm](#classicasm) - Classic CPC palette and raster routines
- [plus.asm](#plusasm) - CPC Plus ASIC unlock and activation
- [classic.h.asm](#classichasm) - Classic raster macro
- [plus.h.asm](#plushasm) - CPC Plus raster macro

---

## overscan.asm

Provides routines for overscan display handling on Amstrad CPC.

### Constants

| Name | Value | Description |
|------|-------|-------------|
| `R1` | 48 | CRTC Register 1 value (horizontal displayed characters) |

### Functions

#### `affscr`

Displays the screen by transferring linear bitmap data to CPC video memory.

**Description:**
Transfers 280 lines of pixel data from a linear buffer to the CPC's interleaved video memory format.

**Registers:**
- Uses: `B`, `C`, `DE`, `HL`
- Modifies: All general purpose registers

**Memory Layout:**
- Source: Linear data at `#4268`
- Destination: Screen address starting at `#0140`
- Line width: `R1 * 2` bytes (96 bytes)

---

#### `outcrtc`

Outputs a sequence of values to CRTC registers.

**Description:**
Reads a table of register values and sends them to the CRTC controller. The table is terminated by `#FF`.

**Parameters:**
- `HL` - Pointer to CRTC register value table

**Returns:**
- When `#FF` terminator is encountered

**Usage Example:**
```z80
    ld hl, tovercrt
    call outcrtc
```

---

#### `adinfuni`

Special address calculation routine for CPC video memory navigation.

**Description:**
Calculates the next line address in CPC video memory, handling the interleaved memory layout. This routine handles the complex CPC screen memory organization where lines are not contiguous.

**Parameters:**
- `HL` - Current screen address

**Returns:**
- `HL` - Next line screen address

**Algorithm:**
1. Adds `#08` to high byte (next character row)
2. If within same 8-line block, returns
3. Otherwise, wraps to next pixel row within character block
4. Handles horizontal offset (`R1 * 2`)

---

### Data Tables

#### `tovercrt`

CRTC register values for overscan mode configuration.

| Register | Value | Description |
|----------|-------|-------------|
| R0 | #3F | Horizontal Total |
| R1 | R1 (48) | Horizontal Displayed |
| R2 | #32 | Horizontal Sync Position |
| R3 | #06 | Sync Widths |
| R4 | #26 | Vertical Total |
| R5 | #00 | Vertical Total Adjust |
| R6 | #21 | Vertical Displayed |
| R7 | #23 | Vertical Sync Position |
| R8 | #00 | Interlace Mode |
| R9 | #07 | Max Raster Address |
| R10 | #00 | Cursor Start |
| R11 | #00 | Cursor End |
| R12 | #0C | Display Start High |
| R13 | 160 | Display Start Low |
| - | #FF | Terminator |

---

## sync.asm

Provides precise VBL (Vertical Blank) synchronization routines.

### Functions

#### `sync_vbl`

Synchronizes execution with the vertical blank signal.

**Description:**
Performs a robust synchronization with the CPC's vertical blank signal. Uses a drift compensation algorithm to achieve cycle-accurate timing.

**Algorithm:**
1. Waits for VSync flag to become active
2. Waits for VSync flag to become inactive
3. Performs a second sync to ensure clean state
4. Uses drift compensation loop to achieve precise timing

**Registers:**
- Uses: `A`, `B`, `DE`, `HL`
- Interrupts: Disabled (`DI`)

**Technical Notes:**
- VSync flag is read from port `#F5xx`
- Uses 19968 NOPs worth of timing (one frame)
- Includes margin compensation for accurate sync

---

#### `wait_usec`

Waits for a specified number of microseconds.

**Description:**
Precision delay routine that waits for exactly `DE` microseconds.

**Parameters:**
- `DE` - Number of microseconds to wait

**Timing Formula:**
```
40 + (((DE/8) - 5) × 8) + (DE AND 7) NOPs
```

**Note:** The `CALL` instruction timing is not included in the count.

---

## classic.asm

Provides palette and raster handling for classic CPC (non-Plus) hardware.

### Functions

#### `setPalette`

Sets the CPC color palette.

**Description:**
Sends palette data to the Gate Array via port `#7Fxx`.

**Parameters:**
- `A` - Starting pen number
- `C` - Number of colors to set
- `HL` - Pointer to color data (implicit, via `OUTI`)

**Registers:**
- Uses: `A`, `B`, `C`
- `B` set to `#7F` (Gate Array port)

---

#### `no_changes`

Raster handler for lines with no palette changes.

**Description:**
Handles scanlines that don't require any palette modifications. Advances to the next raster instruction and jumps to the next handler.

**Timing:** 24 NOPs padding for consistent line timing

---

#### `changes_1`

Raster handler for lines with 1 palette change.

**Description:**
Handles scanlines requiring 2 palette register outputs (1 color change). Includes 12 NOPs padding for timing consistency.

---

#### `changes_2`

Raster handler for lines with 2 palette changes.

**Description:**
Handles scanlines requiring 4 palette register outputs (2 color changes). No padding needed as timing matches the base scanline duration.

---

### Data Tables

#### `jmp_table`

Jump table for raster handlers, aligned to 256-byte boundary.

| Offset | Handler | Description |
|--------|---------|-------------|
| 0 | `no_changes` | No palette changes |
| 2 | `changes_1` | 1 palette change |
| 4 | `changes_2` | 2 palette changes |

---

## plus.asm

Provides ASIC unlock and activation routines for CPC Plus hardware.

### Module: `Asic`

#### `Asic.unlock`

Unlocks the CPC Plus ASIC features.

**Description:**
Sends the 17-byte unlock sequence to port `#BC00` to enable CPC Plus hardware features.

**Registers:**
- Uses: `A`, `BC`, `DE`, `HL`
- Interrupts: Disabled (`DI`)

---

#### `Asic.activate`

Activates CPC Plus extended functions.

**Description:**
Enables access to the ASIC registers by writing to port `#7FB8`.

**Registers:**
- Uses: `BC`

---

### Data

#### `unlock_seq`

The 17-byte ASIC unlock sequence:
```
255, 0, 255, 119, 179, 81, 168, 212, 98, 57, 156, 70, 43, 21, 138, 205, 238
```

---

## classic.h.asm

Macro definitions for classic CPC raster effects.

### Macros

#### `CLASSIC_RASTER n`

Main loop macro for classic CPC raster effects.

**Parameters:**
- `n` - Number of scanlines to process

**Description:**
Sets up and executes a raster effect loop that reads compressed raster data and dispatches to appropriate handlers based on the number of palette changes per line.

**Setup:**
- `HL` points to `RasterData`
- `BC` = `#7F00` (Gate Array port)
- `IX` = end of change handler address
- Uses alternate register set (`EXX`)

**Data Format:**
Raster data is encoded with a count byte indicating the number of palette changes, followed by the actual color values.

---

## plus.h.asm

Macro definitions for CPC Plus raster effects.

### Macros

#### `PLUS_RASTER n`

Main loop macro for CPC Plus raster effects using hardware sprites/palette.

**Parameters:**
- `n` - Number of scanlines to process

**Description:**
Sets up and executes a raster effect loop optimized for CPC Plus hardware. Uses stack-based palette writes for maximum speed.

**Setup:**
- `HL` points to `RasterData`
- Stack pointer temporarily redirected to ASIC palette registers at `#6408`
- Uses `IX`, `IY` for intermediate storage

**Data Format:**
Each line requires 8 bytes of raster data containing palette values to push to the ASIC palette RAM.

**Technical Notes:**
- Uses `PUSH` instructions for fast palette writes
- Stack pointer saved and restored around the loop
- ASIC palette RAM located at `#6400-#640F`

---

## Memory Map Reference

| Address | Description |
|---------|-------------|
| `#0140` | Overscan screen start |
| `#4268` | Linear bitmap data |
| `#6400` | CPC Plus ASIC palette RAM |
| `#7Fxx` | Gate Array (classic palette) |
| `#BCxx` | CRTC register select |
| `#BDxx` | CRTC register data |
| `#F5xx` | VSync status port |

---

## Related Files

- `scr-classic-raster/` - Classic CPC raster mode implementations
- `scr-classic-raster-overscan/` - Classic CPC overscan implementations
- `scr-plus-raster/` - CPC Plus raster mode implementations
- `scr-plus-raster-overscan/` - CPC Plus overscan implementations
