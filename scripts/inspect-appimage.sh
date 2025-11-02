#!/bin/bash
# Inspect AppImage contents to verify desktop file and AppRun

set -e

APPIMAGE_PATH="${1}"

# Download latest release if no path provided
if [ -z "$APPIMAGE_PATH" ]; then
    echo "📥 Downloading latest AppImage release..."
    
    # Get latest release download URL
    DOWNLOAD_URL=$(curl -s https://api.github.com/repos/IIIvan37/pixsaur/releases/latest | \
                   grep "browser_download_url.*AppImage\"" | \
                   grep -v ".tar.gz" | \
                   cut -d : -f 2,3 | \
                   tr -d \")
    
    if [ -z "$DOWNLOAD_URL" ]; then
        echo "Error: Could not find AppImage in latest release"
        exit 1
    fi
    
    APPIMAGE_PATH="Pixsaur_latest.AppImage"
    echo "   Downloading from: $DOWNLOAD_URL"
    curl -L -o "$APPIMAGE_PATH" "$DOWNLOAD_URL"
    chmod +x "$APPIMAGE_PATH"
    echo "   ✓ Downloaded to: $APPIMAGE_PATH"
    echo ""
fi

if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "Error: AppImage not found at $APPIMAGE_PATH"
    echo "Usage: $0 [path/to/Pixsaur.AppImage]"
    exit 1
fi

# Check if squashfs-tools is installed
if ! command -v unsquashfs &> /dev/null; then
    echo "Error: unsquashfs not found"
    echo "Install with: brew install squashfs (macOS) or sudo apt install squashfs-tools (Linux)"
    exit 1
fi

echo "🔍 Inspecting AppImage: $APPIMAGE_PATH"
echo ""

# Find SquashFS offset dynamically
echo "📍 Finding SquashFS offset..."
OFFSET=$(strings -t d "$APPIMAGE_PATH" | grep "hsqs" | tail -1 | awk '{print $1}')
if [ -z "$OFFSET" ]; then
    echo "Error: Could not find SquashFS offset"
    exit 1
fi
echo "   Offset: $OFFSET bytes"
echo ""

# Extract AppImage
echo "📦 Extracting AppImage..."
rm -rf squashfs-root
unsquashfs -q -o "$OFFSET" -d squashfs-root "$APPIMAGE_PATH" 2>/dev/null || true
echo "   ✓ Extraction complete"
echo ""

# Check AppRun
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 AppRun"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f squashfs-root/AppRun ]; then
    echo "✓ Found"
    file squashfs-root/AppRun
    echo ""
    echo "Content:"
    cat squashfs-root/AppRun
else
    echo "✗ NOT FOUND"
fi
echo ""

# Check desktop file
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 Desktop File"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
DESKTOP_FILE=$(find squashfs-root -maxdepth 1 -name "*.desktop" | head -1)
if [ -f "$DESKTOP_FILE" ]; then
    echo "✓ Found: $(basename "$DESKTOP_FILE")"
    echo ""
    echo "Content:"
    cat "$DESKTOP_FILE"
    echo ""
    echo "Verification:"
    
    # Check Exec line
    EXEC_LINE=$(grep "^Exec=" "$DESKTOP_FILE" || echo "")
    if echo "$EXEC_LINE" | grep -q "Exec=AppRun"; then
        echo "   ✓ Exec line correct: $EXEC_LINE"
    else
        echo "   ✗ Exec line WRONG: $EXEC_LINE (should be 'Exec=AppRun %U')"
    fi
    
    # Check Categories
    CATEGORIES=$(grep "^Categories=" "$DESKTOP_FILE" || echo "")
    if [ -n "$CATEGORIES" ] && [ "$CATEGORIES" != "Categories=" ]; then
        echo "   ✓ Categories present: $CATEGORIES"
    else
        echo "   ✗ Categories missing or empty"
    fi
    
    # Check MimeType
    if grep -q "^MimeType=" "$DESKTOP_FILE"; then
        MIMETYPE=$(grep "^MimeType=" "$DESKTOP_FILE")
        echo "   ✓ MimeType present: $MIMETYPE"
    else
        echo "   ⚠ MimeType not set"
    fi
else
    echo "✗ Desktop file NOT FOUND"
fi
echo ""

# Check binaries
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 Binaries"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f squashfs-root/AppRun.wrapped ]; then
    echo "✓ AppRun.wrapped found"
    file squashfs-root/AppRun.wrapped
else
    echo "⚠ AppRun.wrapped not found"
fi

if [ -f squashfs-root/pixsaur ]; then
    echo "✓ pixsaur binary found"
    file squashfs-root/pixsaur
else
    echo "⚠ pixsaur binary not found (normal if renamed to AppRun.wrapped)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "AppImage: $APPIMAGE_PATH"
echo "Size: $(du -h "$APPIMAGE_PATH" | cut -f1)"
echo "Extracted to: squashfs-root/"
echo ""
echo "Use 'rm -rf squashfs-root' to clean up"
