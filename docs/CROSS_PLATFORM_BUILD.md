# Build Multi-Plateforme Pixsaur Desktop

## 🌍 Stratégies de Build Cross-Platform

### Option 1 : GitHub Actions (Recommandé ✅)

**Avantages** :
- ✅ Build automatique sur push de tag
- ✅ Tous les OS en parallèle (Linux, Windows, macOS)
- ✅ Release GitHub automatique avec assets
- ✅ Gratuit pour projets open source
- ✅ Pas besoin d'accès aux 3 OS

**Configuration** : Voir `.github/workflows/release.yml`

**Usage** :
```bash
# 1. Créer un tag de version
git tag v0.1.0
git push origin v0.1.0

# 2. GitHub Actions build automatiquement :
#    - Ubuntu 22.04 → AppImage
#    - Windows → MSI + Setup.exe
#    - macOS → DMG (Intel + Apple Silicon)

# 3. Release draft créée avec tous les binaires
```

**Formats générés** :
- **Linux** : `pixsaur_0.1.0_amd64.AppImage` (~15 MB)
- **Windows** : `pixsaur_0.1.0_x64-setup.exe` + `.msi` (~12 MB)
- **macOS Intel** : `Pixsaur_x64.dmg` (~10 MB)
- **macOS ARM** : `Pixsaur_aarch64.dmg` (~10 MB)

---

### Option 2 : Build Local avec Docker

**Pour Linux** (depuis n'importe quel OS) :
```bash
# Ubuntu 22.04 build environment
docker run --rm -v $(pwd):/app -w /app rust:1.90-slim bash -c "
  apt update && apt install -y pkg-config libwebkit2gtk-4.0-dev build-essential curl && \
  curl -fsSL https://get.pnpm.io/install.sh | bash - && \
  export PNPM_HOME=/root/.local/share/pnpm && \
  export PATH=\$PNPM_HOME:\$PATH && \
  pnpm install && \
  pnpm tauri build
"
```

**Limitations** :
- ❌ Windows et macOS nécessitent un accès natif à l'OS
- ❌ Pas de vraie cross-compilation pour GUI apps

---

### Option 3 : Machines Virtuelles

**Windows build depuis Linux** :
```bash
# Utiliser Wine + mingw (complexe et instable)
# Pas recommandé pour Tauri
```

**macOS build** :
- Nécessite un Mac physique ou VM macOS (licence Apple)
- Ou GitHub Actions (gratuit)

---

### Option 4 : Services Cloud Build

**Alternatives payantes** :
- **CircleCI** : macOS, Linux, Windows builds
- **AppVeyor** : Windows natif
- **Travis CI** : Multi-OS support

**Coût** : ~$30-70/mois

---

## 🎯 Recommandation Finale

### Pour Pixsaur → GitHub Actions ✅

**Workflow complet** :

1. **Développement local** (votre OS actuel - Linux)
   ```bash
   pnpm tauri:dev
   ```

2. **Build local** (test uniquement Linux)
   ```bash
   pnpm tauri:build
   # Génère : src-tauri/target/release/bundle/appimage/
   ```

3. **Release multi-plateforme** (GitHub Actions)
   ```bash
   # Bump version dans package.json et tauri.conf.json
   git add .
   git commit -m "chore: bump version to 0.1.0"
   git tag v0.1.0
   git push origin main
   git push origin v0.1.0
   
   # GitHub Actions build :
   # - Linux AppImage
   # - Windows MSI + Setup
   # - macOS DMG (Intel + ARM)
   
   # Résultat : Release draft avec 5 fichiers
   ```

4. **Distribution**
   - Publier la release GitHub
   - Optionnel : Winget (Windows), Homebrew (macOS), Flathub (Linux)

---

## 📦 Formats par Plateforme

### Linux
- **AppImage** : Portable, fonctionne partout (recommandé)
- **Deb** : Ubuntu/Debian (ajout dans `tauri.conf.json`)
- **RPM** : Fedora/RHEL (ajout dans `tauri.conf.json`)

### Windows
- **MSI** : Installeur standard
- **NSIS** : Setup.exe moderne

### macOS
- **DMG** : Image disque standard
- **App Bundle** : `.app` pour distribution directe

---

## 🔧 Configuration Multi-Bundle

Dans `src-tauri/tauri.conf.json` :

```json
{
  "bundle": {
    "active": true,
    "targets": ["appimage", "deb", "rpm", "msi", "nsis", "dmg", "app"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "identifier": "com.pixsaur.desktop",
    "publisher": "IIIvan37",
    "category": "Graphics",
    "shortDescription": "Amstrad CPC Image Converter",
    "longDescription": "Convert modern images to Amstrad CPC formats with quantization, dithering, and palette management.",
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.0-37"]
      }
    },
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "macOS": {
      "minimumSystemVersion": "10.13",
      "frameworks": [],
      "entitlements": null
    }
  }
}
```

---

## 🚀 Quick Start

**Setup GitHub Actions** :
1. ✅ Déjà configuré : `.github/workflows/release.yml`
2. Créer un tag : `git tag v0.1.0 && git push origin v0.1.0`
3. Attendre 15-20 min (builds en parallèle)
4. Télécharger les binaires dans Releases

**Coût** : 0€ (gratuit pour open source)

---

## 🔒 Code Signing (Optionnel)

### Windows
```bash
# Certificat EV nécessaire (~$300/an)
# Évite "Windows protected your PC"
```

### macOS
```bash
# Apple Developer Program ($99/an)
# Nécessaire pour notarisation
```

### Linux
```bash
# Pas de signature requise
# AppImage fonctionne sans certificat
```

**Pour débuter** : Pas de signature, ajouter note dans README que Windows/macOS afficheront des warnings.

---

## 📚 Resources

- [Tauri Building](https://tauri.app/v2/guides/building/)
- [Tauri GitHub Actions](https://tauri.app/v2/guides/building/github-actions/)
- [Cross-Platform Compilation](https://tauri.app/v2/guides/building/cross-platform/)

