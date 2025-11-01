#!/bin/bash

# Script pour créer un AppImage compatible avec Arch Linux
# Inspiré de la solution de l'utilisateur

set -e

VERSION_NUM="$1"
WORK_DIR="appimage_build"

if [ -z "$VERSION_NUM" ]; then
    echo "Usage: $0 <version_number>"
    exit 1
fi

echo "Creating AppImage for version $VERSION_NUM"

# Clean up previous builds
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/pixsaur"

# Download appimagetool
if [ ! -f "appimagetool-x86_64.AppImage" ]; then
    echo "Downloading appimagetool..."
    wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x appimagetool-x86_64.AppImage
fi

# Extract .deb file
echo "Extracting .deb file..."
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -1)
if [ ! -f "$DEB_FILE" ]; then
    echo "Error: .deb file not found"
    exit 1
fi

mkdir -p "$WORK_DIR/deb"
ar x "$DEB_FILE" --output "$WORK_DIR/deb"
tar -xzf "$WORK_DIR/deb/data.tar.gz" -C "$WORK_DIR/deb"

# Copy binary
echo "Copying binary..."
cp "$WORK_DIR/deb/usr/bin/pixsaur" "$WORK_DIR/pixsaur/"

# Create AppRun script with EGL fixes
cat > "$WORK_DIR/pixsaur/AppRun" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export APPDIR="$(dirname "$(readlink -f "$0")")"

# Fix EGL issues on Arch Linux and other distributions
export LIBGL_ALWAYS_SOFTWARE=0
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LD_LIBRARY_PATH="${APPDIR}/usr/lib:${LD_LIBRARY_PATH}"
export WEBKIT_FORCE_SANDBOX=0
export WEBKIT_DISABLE_TBS=1

# Execute with fallback to software rendering
if ! ./pixsaur "$@" 2>/dev/null; then
    echo "Hardware acceleration failed, trying software rendering..."
    export LIBGL_ALWAYS_SOFTWARE=1
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    exec ./pixsaur "$@"
else
    exec ./pixsaur "$@"
fi
EOF
chmod +x "$WORK_DIR/pixsaur/AppRun"

# Create desktop file
cat > "$WORK_DIR/pixsaur/pixsaur.desktop" << 'EOF'
[Desktop Entry]
Categories=Graphics;
Comment=Amstrad CPC Image Converter - Desktop Application
Exec=AppRun
StartupNotify=true
Icon=pixsaur
Name=Pixsaur
Terminal=false
Type=Application
EOF

# Copy icon
cp src-tauri/icons/128x128.png "$WORK_DIR/pixsaur/pixsaur.png"

# Create AppImage
echo "Creating AppImage..."
ARCH=x86_64 ./appimagetool-x86_64.AppImage "$WORK_DIR/pixsaur" "Pixsaur_${VERSION_NUM}_amd64.AppImage"

# Make executable
chmod +x "Pixsaur_${VERSION_NUM}_amd64.AppImage"

# Clean up
rm -rf "$WORK_DIR"

echo "AppImage created: Pixsaur_${VERSION_NUM}_amd64.AppImage"