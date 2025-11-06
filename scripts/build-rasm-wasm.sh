#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}RASM WebAssembly Build Script${NC}"
echo "========================================================="
echo "This script will:"
echo "  • Check for Emscripten (emsdk)"
echo "  • Clone RASM v2.3.9 (stable release)"
echo "  • Compile RASM to WebAssembly with compression support"
echo "  • Copy artifacts (rasm.js, rasm.wasm, LICENSE) to public/wasm/"
echo ""

# Configuration
RASM_VERSION="v2.3.9"
RASM_REPO="https://github.com/EdouardBERGE/rasm.git"
BUILD_DIR="/tmp/rasm-build-$$"
OUTPUT_DIR="$(pwd)/public/wasm"

# Detect operating system
OS_TYPE=$(uname -s)

if [ "$OS_TYPE" = "Darwin" ]; then
    OS="macos"
    echo -e "${GREEN}Detected: macOS${NC}"
elif [ "$OS_TYPE" = "Linux" ]; then
    OS="linux"
    echo -e "${GREEN}Detected: Linux${NC}"
else
    echo -e "${RED}Error: Unsupported operating system: $OS_TYPE${NC}"
    echo "This script supports macOS and Linux only."
    exit 1
fi

echo ""

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Error: Emscripten (emcc) not found in PATH${NC}"
    echo ""
    echo "Please install Emscripten SDK (emsdk):"
    echo ""
    echo "  # Clone emsdk"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo ""
    echo "  # Install and activate latest SDK"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo ""
    echo "  # Add to your shell profile (e.g., ~/.zshrc or ~/.bashrc):"
    echo "  source \"\$(pwd)/emsdk_env.sh\""
    echo ""
    echo "Then run this script again."
    exit 1
else
    EMCC_VERSION=$(emcc --version | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
    echo -e "${GREEN}✓ Emscripten $EMCC_VERSION found${NC}"
fi

echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed${NC}"
    exit 1
fi

# Create build directory
echo -e "${BLUE}Creating build directory: $BUILD_DIR${NC}"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Clone RASM
echo -e "${BLUE}Cloning RASM $RASM_VERSION...${NC}"
git clone --depth 1 --branch "$RASM_VERSION" "$RASM_REPO" rasm
cd rasm

echo -e "${GREEN}✓ RASM $RASM_VERSION cloned${NC}"
echo ""

# List compression source files
echo -e "${BLUE}Preparing source files for compilation...${NC}"

# Main source file
MAIN_SOURCE="rasm.c"

# Compression library sources (required for full functionality)
COMPRESSION_SOURCES=(
    "ZX0-main/src/compress.c"
    "ZX0-main/src/optimize.c"
    "ZX0-main/src/memory.c"
    "apultra-master/src/shrink.c"
    "apultra-master/src/expand.c"
    "apultra-master/src/matchfinder.c"
    "apultra-master/src/libdivsufsort/lib/divsufsort.c"
    "apultra-master/src/libdivsufsort/lib/divsufsort_utils.c"
    "apultra-master/src/libdivsufsort/lib/sssort.c"
    "apultra-master/src/libdivsufsort/lib/trsort.c"
    "lzsa-master/src/shrink_block_v1.c"
    "lzsa-master/src/shrink_block_v2.c"
    "lzsa-master/src/expand_block_v1.c"
    "lzsa-master/src/expand_block_v2.c"
    "lzsa-master/src/expand_context.c"
    "lzsa-master/src/frame.c"
    "lzsa-master/src/matchfinder.c"
    "lzsa-master/src/shrink_context.c"
    "lzsa-master/src/stream.c"
    "lzsa-master/src/shrink_inmem.c"
    "lzsa-master/src/expand_inmem.c"
)

# Build source file list
SOURCE_FILES="$MAIN_SOURCE"
for src in "${COMPRESSION_SOURCES[@]}"; do
    if [ -f "$src" ]; then
        SOURCE_FILES="$SOURCE_FILES $src"
    else
        echo -e "${YELLOW}Warning: $src not found, skipping${NC}"
    fi
done

echo -e "${GREEN}✓ Source files prepared${NC}"
echo ""

# Compile to WebAssembly
echo -e "${BLUE}Compiling RASM to WebAssembly...${NC}"
echo -e "${YELLOW}This may take a minute...${NC}"
echo ""

# Add include paths for compression libraries
INCLUDE_PATHS="-I. -IZX0-main/src -Iapultra-master/src -Iapultra-master/src/libdivsufsort/include -Ilzsa-master/src"

emcc $SOURCE_FILES \
    $INCLUDE_PATHS \
    -s MODULARIZE=1 \
    -s EXPORT_NAME=createRasmModule \
    -s EXPORTED_RUNTIME_METHODS='["FS","callMain"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=33554432 \
    -s ENVIRONMENT=web \
    -s FILESYSTEM=1 \
    -O2 \
    -o rasm.js

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Compilation successful!${NC}"
else
    echo -e "${RED}Error: Compilation failed${NC}"
    exit 1
fi

echo ""

# Check output files
if [ ! -f "rasm.js" ] || [ ! -f "rasm.wasm" ]; then
    echo -e "${RED}Error: Output files not found${NC}"
    exit 1
fi

# Display file sizes
RASM_JS_SIZE=$(ls -lh rasm.js | awk '{print $5}')
RASM_WASM_SIZE=$(ls -lh rasm.wasm | awk '{print $5}')

echo -e "${BLUE}Build artifacts:${NC}"
echo "  rasm.js:   $RASM_JS_SIZE"
echo "  rasm.wasm: $RASM_WASM_SIZE"
echo ""

# Create output directory
echo -e "${BLUE}Preparing output directory: $OUTPUT_DIR${NC}"
mkdir -p "$OUTPUT_DIR"

# Copy artifacts
echo -e "${BLUE}Copying artifacts to $OUTPUT_DIR...${NC}"
cp rasm.js "$OUTPUT_DIR/"
cp rasm.wasm "$OUTPUT_DIR/"

# Create RASM license file (extracted from rasm.c source)
cat > "$OUTPUT_DIR/RASM-LICENSE.txt" << 'EOF'
RASM Z80 Assembler
Copyright (c) 2017 Edouard BERGE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

================================================================================
This WebAssembly build also includes the following compression libraries:

ZX0, apultra, and lzsa - Each with their own respective licenses.
See their individual repositories for license details.
EOF

echo -e "${GREEN}✓ Artifacts copied successfully${NC}"
echo ""

# Cleanup build directory
echo -e "${BLUE}Cleaning up build directory...${NC}"
cd /
rm -rf "$BUILD_DIR"

echo -e "${GREEN}✓ Build directory cleaned${NC}"
echo ""

echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}RASM WebAssembly build complete! 🎉${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo ""
echo -e "${BLUE}Output location:${NC}"
echo "  $OUTPUT_DIR/rasm.js"
echo "  $OUTPUT_DIR/rasm.wasm"
echo "  $OUTPUT_DIR/RASM-LICENSE.txt"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Create a TypeScript wrapper to load and use the WASM module"
echo "  2. Integrate into your UI components"
echo "  3. Test assembly functionality in the browser"
echo ""
