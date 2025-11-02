#!/usr/bin/env bash
set -e

# Configuration
APP_NAME="pixsaur"
VERSION="${1:-0.0.0}"
ARCH="x86_64"
BUILD_DIR="build/appimage"
APPDIR="${BUILD_DIR}/AppDir"
DEB_DIR="${BUILD_DIR}/deb"

echo "=== Building AppImage for ${APP_NAME} v${VERSION} ==="

# Clean and create build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${DEB_DIR}"

# 1. Find the .deb file (auto-detect version if not provided)
DEB_SEARCH_DIR="src-tauri/target/release/bundle/deb"
if [ ! -d "${DEB_SEARCH_DIR}" ]; then
  echo "ERROR: Deb directory not found at ${DEB_SEARCH_DIR}"
  echo "Run 'cd src-tauri && cargo tauri build --bundles deb' first"
  exit 1
fi

DEB_FILE=$(find "${DEB_SEARCH_DIR}" -name "${APP_NAME}_*.deb" -o -name "Pixsaur_*.deb" | head -n 1)
if [ -z "${DEB_FILE}" ] || [ ! -f "${DEB_FILE}" ]; then
  echo "ERROR: No .deb file found in ${DEB_SEARCH_DIR}"
  echo "Run 'cd src-tauri && cargo tauri build --bundles deb' first"
  exit 1
fi

# Extract version from .deb filename if VERSION is default
if [ "${VERSION}" = "0.0.0" ]; then
  VERSION=$(basename "${DEB_FILE}" | cut -d_ -f2)
  echo "Auto-detected version: ${VERSION}"
fi

echo "Using .deb file: ${DEB_FILE}"

# 2. Extract .deb file
echo "Extracting .deb file..."
ar x "${DEB_FILE}" --output "${DEB_DIR}"
tar -xzf "${DEB_DIR}/data.tar.gz" -C "${DEB_DIR}"

# 3. Copy binary from extracted .deb (contains frontend embedded)
echo "Copying binary from .deb..."
cp "${DEB_DIR}/usr/bin/${APP_NAME}" "${APPDIR}/usr/bin/${APP_NAME}"
chmod +x "${APPDIR}/usr/bin/${APP_NAME}"

# 4. Create AppRun script at root (not a symlink)
echo "Creating AppRun script..."
cat > "${APPDIR}/AppRun" << 'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec usr/bin/pixsaur "$@"
EOF
chmod +x "${APPDIR}/AppRun"

# 5. Copy desktop file to root
echo "Copying desktop file..."
cp "src-tauri/${APP_NAME}.desktop" "${APPDIR}/${APP_NAME}.desktop"
# Update Exec to use AppRun
sed -i 's/^Exec=.*/Exec=AppRun %U/' "${APPDIR}/${APP_NAME}.desktop"
# Add version
echo "X-AppImage-Version=v${VERSION}" >> "${APPDIR}/${APP_NAME}.desktop"

# 6. Copy icon to root
echo "Copying icon..."
if [ -f "src-tauri/icons/128x128.png" ]; then
  cp "src-tauri/icons/128x128.png" "${APPDIR}/${APP_NAME}.png"
elif [ -f "src-tauri/icons/icon.png" ]; then
  cp "src-tauri/icons/icon.png" "${APPDIR}/${APP_NAME}.png"
else
  echo "ERROR: No icon found in src-tauri/icons/"
  exit 1
fi

# 7. Verify structure
echo "Verifying AppDir structure..."
if [ ! -x "${APPDIR}/AppRun" ]; then
  echo "ERROR: AppRun is not executable"
  exit 1
fi
if [ ! -f "${APPDIR}/${APP_NAME}.desktop" ]; then
  echo "ERROR: Desktop file missing"
  exit 1
fi
if [ ! -f "${APPDIR}/${APP_NAME}.png" ]; then
  echo "ERROR: Icon missing"
  exit 1
fi
if [ ! -x "${APPDIR}/usr/bin/${APP_NAME}" ]; then
  echo "ERROR: Binary missing or not executable"
  exit 1
fi

echo "AppDir structure:"
ls -lah "${APPDIR}/"
echo ""
echo "Binary size:"
ls -lh "${APPDIR}/usr/bin/${APP_NAME}"

# 8. Download appimagetool if needed
if [ ! -f "appimagetool-x86_64.AppImage" ]; then
  echo "Downloading appimagetool..."
  wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x appimagetool-x86_64.AppImage
fi

# 9. Build AppImage
echo "Building AppImage..."
OUTPUT_FILE="${BUILD_DIR}/${APP_NAME}_${VERSION}_amd64.AppImage"
ARCH=${ARCH} ./appimagetool-x86_64.AppImage "${APPDIR}" "${OUTPUT_FILE}"

# 10. Make AppImage executable
chmod +x "${OUTPUT_FILE}"

echo ""
echo "=== AppImage built successfully ==="
echo "Output: ${OUTPUT_FILE}"
ls -lh "${OUTPUT_FILE}"
echo ""
echo "To run: ./${OUTPUT_FILE}"
