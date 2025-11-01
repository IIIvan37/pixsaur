#!/bin/bash

# Script pour générer le fichier latest.json correct pour la v0.1.9
# Ce script corrige le problème où les URLs pointent vers .dmg au lieu de .app.tar.gz

VERSION="v0.1.9"
REPO="IIIvan37/pixsaur"
TIMESTAMP="2025-11-01T04:14:29+01:00"

echo "🔧 Génération du fichier latest.json corrigé pour $VERSION"
echo ""

cat > latest.json << 'EOF'
{
    "version": "v0.1.9",
    "notes": "See release notes at https://github.com/IIIvan37/pixsaur/releases/tag/v0.1.9",
    "pub_date": "2025-11-01T04:14:29+01:00",
    "platforms": {
        "linux-x86_64": {
            "signature": "PLACEHOLDER_FOR_LINUX_SIGNATURE",
            "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_0.1.9_amd64.AppImage.tar.gz"
        },
        "windows-x86_64": {
            "signature": "PLACEHOLDER_FOR_WINDOWS_SIGNATURE",
            "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_0.1.9_x64-setup.nsis.zip"
        },
        "darwin-x86_64": {
            "signature": "PLACEHOLDER_FOR_X64_SIGNATURE",
            "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_x64.app.tar.gz"
        },
        "darwin-aarch64": {
            "signature": "PLACEHOLDER_FOR_AARCH64_SIGNATURE",
            "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_aarch64.app.tar.gz"
        }
    }
}
EOF

echo "✅ Fichier latest.json généré"
echo ""
cat latest.json
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 PROCHAINES ÉTAPES:"
echo ""
echo "1️⃣  Builder l'app localement pour générer les fichiers .app.tar.gz:"
echo "   pnpm tauri build --target aarch64-apple-darwin"
echo ""
echo "2️⃣  Trouver les fichiers générés:"
echo "   ls -la src-tauri/target/aarch64-apple-darwin/release/bundle/macos/"
echo ""
echo "   Vous devriez voir:"
echo "   - Pixsaur_aarch64.app.tar.gz"
echo "   - Pixsaur_aarch64.app.tar.gz.sig"
echo ""
echo "3️⃣  Remplacer les PLACEHOLDER dans latest.json:"
echo "   - Copier le contenu de Pixsaur_aarch64.app.tar.gz.sig"
echo "   - Remplacer PLACEHOLDER_FOR_AARCH64_SIGNATURE"
echo ""
echo "4️⃣  Uploader les fichiers sur GitHub:"
echo "   - Aller sur https://github.com/IIIvan37/pixsaur/releases/tag/v0.1.9"
echo "   - Cliquer 'Edit release'"
echo "   - Uploader: Pixsaur_aarch64.app.tar.gz"
echo "   - Uploader: Pixsaur_aarch64.app.tar.gz.sig"
echo "   - Remplacer latest.json par le nouveau"
echo ""
echo "5️⃣  Tester:"
echo "   ./scripts/check-updater-config.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
