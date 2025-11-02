#!/bin/bash
set -e

VERSION=$1
REPO="IIIvan37/pixsaur"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v0.1.31"
  exit 1
fi

# Remove 'v' prefix if present
VERSION_NUM=${VERSION#v}

cat << EOF
## 📥 Downloads

Choose the installer for your platform:

### Windows
- **💻 [Pixsaur_${VERSION_NUM}_x64-setup.exe](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_x64-setup.exe)** - Recommended installer
- 📦 [Pixsaur_${VERSION_NUM}_x64_en-US.msi](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_x64_en-US.msi) - MSI package

### macOS
- **🍎 [Pixsaur_${VERSION_NUM}_aarch64.dmg](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_aarch64.dmg)** - Apple Silicon (M1/M2/M3)
- 🍎 [Pixsaur_${VERSION_NUM}_x64.dmg](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_x64.dmg) - Intel (x64)

### Linux
- **🐧 [Pixsaur_${VERSION_NUM}_amd64.AppImage](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_amd64.AppImage)** - Universal AppImage
- 📦 [Pixsaur_${VERSION_NUM}_amd64.deb](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur_${VERSION_NUM}_amd64.deb) - Debian/Ubuntu
- 📦 [Pixsaur-${VERSION_NUM}-1.x86_64.rpm](https://github.com/${REPO}/releases/download/${VERSION}/Pixsaur-${VERSION_NUM}-1.x86_64.rpm) - Fedora/RHEL/openSUSE

---

### 🔄 Auto-Updates

The app includes an **automatic updater**. You'll be notified when a new version is available.

<details>
<summary>🔧 For developers: Other files</summary>

- **Signatures** (\`.sig\` files) - Used for verifying updates
- **Archives** (\`.tar.gz\` files) - Used by the auto-updater
- **latest.json** - Update metadata

</details>
EOF
