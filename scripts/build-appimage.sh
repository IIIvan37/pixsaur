#!/usr/bin/env bash
set -e

# Configuration
APP_NAME="pixsaur"
VERSION="${1:-0.0.0}"
ARCH="x86_64"
BUILD_DIR="build/appimage"
APPDIR="${BUILD_DIR}/AppDir"

echo "=== Building AppImage for ${APP_NAME} v${VERSION} ==="

# Clean and create build directory
rm -rf "${BUILD_DIR}"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

# 1. Check if binary exists
if [ ! -f "src-tauri/target/release/${APP_NAME}" ]; then
  echo "ERROR: Binary not found at src-tauri/target/release/${APP_NAME}"
  echo "Run 'pnpm tauri build --bundles none' first"
  exit 1
fi

# 2. Copy binary to usr/bin (standard structure)
echo "Copying binary..."
cp "src-tauri/target/release/${APP_NAME}" "${APPDIR}/usr/bin/${APP_NAME}"
chmod +x "${APPDIR}/usr/bin/${APP_NAME}"

# 3. Copy desktop file to usr/share/applications
echo "Copying desktop file..."
cp "src-tauri/${APP_NAME}.desktop" "${APPDIR}/usr/share/applications/${APP_NAME}.desktop"

# 4. Add version to desktop file
echo "Adding version to desktop file..."
echo "X-AppImage-Version=v${VERSION}" >> "${APPDIR}/usr/share/applications/${APP_NAME}.desktop"

# 5. Copy icon to usr/share/icons
echo "Copying icon..."
if [ -f "src-tauri/icons/128x128.png" ]; then
  cp "src-tauri/icons/128x128.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"
elif [ -f "src-tauri/icons/icon.png" ]; then
  cp "src-tauri/icons/icon.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"
else
  echo "ERROR: No icon found in src-tauri/icons/"
  exit 1
fi

# 6. Create top-level symlinks (required by AppImage spec)
echo "Creating symlinks..."
ln -s usr/bin/${APP_NAME} "${APPDIR}/AppRun"
ln -s usr/share/applications/${APP_NAME}.desktop "${APPDIR}/${APP_NAME}.desktop"
ln -s usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png "${APPDIR}/${APP_NAME}.png"

# 7. Verify structure
echo "Verifying AppDir structure..."
if [ ! -L "${APPDIR}/AppRun" ] && [ ! -x "${APPDIR}/AppRun" ]; then
  echo "ERROR: AppRun is not a symlink or not executable"
  exit 1
fi
if [ ! -L "${APPDIR}/${APP_NAME}.desktop" ]; then
  echo "ERROR: Desktop file symlink missing"
  exit 1
fi
if [ ! -L "${APPDIR}/${APP_NAME}.png" ]; then
  echo "ERROR: Icon symlink missing"
  exit 1
fi
if [ ! -x "${APPDIR}/usr/bin/${APP_NAME}" ]; then
  echo "ERROR: Binary missing or not executable"
  exit 1
fi

echo "AppDir structure:"
ls -lah "${APPDIR}/"
echo ""
echo "usr/bin contents:"
ls -lah "${APPDIR}/usr/bin/"

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
