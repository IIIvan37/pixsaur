# Pixsaur Desktop - Tauri Implementation

## 🎯 Overview

Version desktop de Pixsaur utilisant **Tauri 2.x** pour une application native multi-plateforme (Linux, Windows, macOS).

### Pourquoi Tauri ?

**Avantages vs Electron :**
- ✅ **Taille** : ~3-10 MB (vs ~120 MB Electron)
- ✅ **Mémoire** : 50% moins que Electron
- ✅ **Sécurité** : Rust natif, permissions granulaires
- ✅ **Performance** : WebView natif du système
- ✅ **Stack compatible** : Vite + React inchangés

## 🚀 Quick Start

### Prérequis

**Script d'installation automatique (recommandé)** :
```bash
# Lance l'installation des dépendances système
./scripts/install-tauri-deps.sh
```

**Rust** (installé automatiquement si absent) :
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**Dépendances système Linux (installation manuelle)** :
```bash
# Ubuntu/Debian (24.04+)
sudo apt update
sudo apt install -y \
  pkg-config \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Ubuntu/Debian (anciennes versions)
# Si libwebkit2gtk-4.1-dev n'existe pas, utilisez :
sudo apt install -y \
  pkg-config \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libappindicator3-dev \
  librsvg2-dev

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg pkgconf
```

### Commandes

```bash
# Développement (lance le WebView desktop + Vite HMR)
pnpm tauri:dev

# Build production (génère binaires natifs)
pnpm tauri:build

# Vérifier la config Tauri
pnpm tauri info
```

## 📁 Structure

```
src-tauri/
├── Cargo.toml              # Dépendances Rust
├── tauri.conf.json         # Configuration Tauri
├── build.rs                # Script de build
├── src/
│   ├── main.rs            # Entry point
│   └── lib.rs             # Core Tauri app
├── icons/                  # Icônes multi-résolutions
└── capabilities/           # Permissions sécurisées
```

## ⚙️ Configuration

### `tauri.conf.json`

```json
{
  "productName": "Pixsaur",
  "identifier": "com.pixsaur.app",
  "app": {
    "windows": [{
      "title": "Pixsaur - Amstrad CPC Image Converter",
      "width": 1400,
      "height": 900,
      "minWidth": 1024,
      "minHeight": 768
    }]
  }
}
```

### Permissions Activées

- **`dialog`** : Sélection fichiers (images) et sauvegarde exports
- **`fs`** : Écriture fichiers locaux (SCR, ASM, DSK)
- **`core`** : APIs système de base

## 🔧 Spécificités Desktop

### File System API

Remplace les `<a download>` web par des sauvegardes natives :

```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// Sauvegarde export SCR
const filePath = await save({
  defaultPath: 'image.scr',
  filters: [{ name: 'SCR Files', extensions: ['scr'] }]
});

if (filePath) {
  await writeFile(filePath, scrData);
}
```

### Drag & Drop

Dropzone React fonctionne nativement dans Tauri.

### Performance

- **WebGL/Canvas** : Identique au web
- **ReGL** : Support complet GPU
- **Memory** : Gestion native optimisée

## 📦 Build Production

### Génération Binaires

```bash
pnpm tauri:build
```

**Output** (selon OS) :
- **Linux** : `src-tauri/target/release/bundle/appimage/pixsaur_0.1.0_amd64.AppImage`
- **Windows** : `pixsaur_0.1.0_x64_en-US.msi`
- **macOS** : `Pixsaur.dmg`

### Tailles Estimées

| Platform | Size |
|----------|------|
| Linux AppImage | ~15 MB |
| Windows MSI | ~12 MB |
| macOS DMG | ~10 MB |

### Auto-Update (Future)

Tauri supporte les mises à jour automatiques via `tauri-plugin-updater`.

## 🔒 Sécurité

### Content Security Policy

Désactivé pour compatibilité Canvas/WebGL :
```json
"security": { "csp": null }
```

### Permissions Granulaires

Définies dans `capabilities/main-capability.json` :
```json
{
  "permissions": [
    "dialog:default",
    "fs:default",
    "core:default"
  ]
}
```

## 🐛 Debugging

### DevTools

Ouvrir DevTools dans l'app desktop :
- **Linux/Windows** : `Ctrl+Shift+I`
- **macOS** : `Cmd+Option+I`

### Logs

Actifs en mode développement :
```rust
tauri_plugin_log::Builder::default()
  .level(log::LevelFilter::Info)
  .build()
```

## 🚧 Limitations Connues

1. **Première compilation** : 2-5 minutes (compilation Rust complète)
2. **WebView Linux** : Nécessite `webkit2gtk-4.1` (non disponible sur anciennes distros)
3. **Canvas limitations** : Identiques au web (pas de changement)

## 📊 Comparaison Web vs Desktop

| Feature | Web | Desktop |
|---------|-----|---------|
| File system access | Download only | Native read/write |
| Offline | Service Worker | Full offline |
| Performance | Identique | Identique |
| Size | 0 (web) | ~15 MB |
| Installation | Aucune | AppImage/MSI/DMG |
| Updates | Instant | Auto-updater |

## 🗺️ Roadmap Desktop

### ✅ Implémenté (Phase 1)
- [x] Configuration Tauri 2.x
- [x] Build Linux/Windows/macOS
- [x] Permissions dialog/fs
- [x] WebGL/Canvas support

### 🚧 Prochain (Phase 2)
- [ ] Native file dialogs pour exports
- [ ] Icônes personnalisées Pixsaur
- [ ] Menu natif (File, Edit, Help)
- [ ] Raccourcis clavier globaux

### 📋 Futur (Phase 3)
- [ ] Auto-updater
- [ ] Système de plugins
- [ ] Notifications natives
- [ ] Intégration OS (file associations)

## 🤝 Contribution

### Développer

```bash
git checkout feature/tauri-desktop
pnpm install
pnpm tauri:dev
```

### Build Multi-Platform

Tauri supporte cross-compilation via GitHub Actions (voir `.github/workflows/release.yml` à créer).

## 📚 Ressources

- [Tauri Docs](https://tauri.app/)
- [Tauri Guides](https://tauri.app/v2/guides/)
- [Tauri Plugins](https://github.com/tauri-apps/plugins-workspace)
- [GitHub Discussions](https://github.com/tauri-apps/tauri/discussions)

---

**Branche** : `feature/tauri-desktop`
**Status** : ✅ Fonctionnel
**Maintainer** : IIIvan37
