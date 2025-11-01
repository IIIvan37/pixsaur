#!/bin/bash
# Script pour mettre à jour latest.json avec les vraies signatures après une release

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: ./update-latest-json.sh v0.1.21"
    exit 1
fi

echo "Updating latest.json for ${VERSION}..."
echo ""

# Télécharger les fichiers .sig depuis GitHub
REPO="IIIvan37/pixsaur"
VERSION_NUM="${VERSION#v}"

echo "Downloading signature files..."

# Linux
LINUX_SIG=$(curl -sL "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_amd64.AppImage.tar.gz.sig" || echo "")

# macOS x64
DARWIN_X64_SIG=$(curl -sL "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_x64.app.tar.gz.sig" || echo "")

# macOS aarch64
DARWIN_AARCH64_SIG=$(curl -sL "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_aarch64.app.tar.gz.sig" || echo "")

# Windows (souvent vide car pas signé)
WINDOWS_SIG=$(curl -sL "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_x64_en-US.msi.zip.sig" 2>/dev/null || echo "")

# Obtenir la date de publication
PUB_DATE=$(gh release view "${VERSION}" --json publishedAt --jq '.publishedAt')

echo ""
echo "Generating latest.json..."

cat > latest.json << EOF
{
  "version": "${VERSION}",
  "notes": "See release notes at https://github.com/${REPO}/releases/tag/${VERSION}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "linux-x86_64": {
      "signature": "${LINUX_SIG}",
      "url": "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "${WINDOWS_SIG}",
      "url": "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_x64-setup.nsis.zip"
    },
    "darwin-x86_64": {
      "signature": "${DARWIN_X64_SIG}",
      "url": "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "${DARWIN_AARCH64_SIG}",
      "url": "https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_aarch64.app.tar.gz"
    }
  }
}
EOF

echo ""
echo "✓ Generated latest.json:"
echo ""
cat latest.json
echo ""
echo ""
echo "Signatures status:"
echo "  Linux:          $([ -n "$LINUX_SIG" ] && echo "✓" || echo "✗ missing")"
echo "  macOS x64:      $([ -n "$DARWIN_X64_SIG" ] && echo "✓" || echo "✗ missing")"
echo "  macOS aarch64:  $([ -n "$DARWIN_AARCH64_SIG" ] && echo "✓" || echo "✗ missing")"
echo "  Windows:        $([ -n "$WINDOWS_SIG" ] && echo "✓" || echo "✗ missing")"
echo ""
echo ""
echo "To upload to GitHub release:"
echo "  gh release upload ${VERSION} latest.json --clobber"
