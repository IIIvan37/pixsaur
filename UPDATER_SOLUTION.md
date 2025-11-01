# 🔧 Solution Updater - Tauri v2 (Toutes plateformes)

## ❌ Problème identifié

**Tauri v2 ne génère plus automatiquement les archives `.tar.gz` et `.zip` pour l'updater**, même avec `createUpdaterArtifacts: true` dans `tauri.conf.json`.

### Ce qui est généré par Tauri v2 :

- ✅ Fichiers d'installation originaux (`.AppImage`, `.exe`, `.app`, `.dmg`)
- ✅ Signatures (`.sig`) pour ces fichiers
- ❌ **PAS** les archives compressées (`.tar.gz`, `.zip`) nécessaires pour l'updater

### Pourquoi c'est un problème ?

L'updater Tauri a besoin de formats spécifiques :

| Plateforme | Installation | Updater requis     |
| ---------- | ------------ | ------------------ |
| Linux      | `.AppImage`  | `.AppImage.tar.gz` |
| Windows    | `.exe`       | `.nsis.zip`        |
| macOS      | `.dmg`       | `.app.tar.gz`      |

## ✅ Solution implémentée

### 1. Script de création des archives

Un script `scripts/create-updater-archives.sh` a été créé pour générer automatiquement les archives après le build.

Le script :

- Compresse les fichiers d'installation dans le bon format
- Copie les signatures existantes vers les nouvelles archives
- Fonctionne pour Linux, macOS et Windows

### 2. Modification du workflow GitHub Actions

Le fichier `.github/workflows/release.yml` a été modifié pour :

- Exécuter le script après chaque build
- Créer les archives pour chaque plateforme

### 3. Configuration Tauri

Dans `src-tauri/tauri.conf.json`, le target `app` a été ajouté :

```json
{
  "bundle": {
    "targets": [
      "app", // ← Nécessaire pour macOS updater
      "deb",
      "rpm",
      "appimage", // ← Nécessaire pour Linux updater
      "dmg",
      "msi",
      "nsis" // ← Nécessaire pour Windows updater
    ],
    "createUpdaterArtifacts": true
  }
}
```

## 📋 Fichiers modifiés

1. `scripts/create-updater-archives.sh` - Script de création des archives
2. `.github/workflows/release.yml` - Ajout des étapes de création d'archives
3. `src-tauri/tauri.conf.json` - Ajout du target `app`

## 🚀 Prochaine release

Lors de la prochaine release (v0.1.11+), les archives updater seront automatiquement générées et uploadées sur GitHub, permettant à l'updater de fonctionner correctement.

### Fichiers qui seront uploadés :

**Linux :**

- `Pixsaur_X.X.X_amd64.AppImage`
- `Pixsaur_X.X.X_amd64.AppImage.tar.gz` ← Pour l'updater
- `Pixsaur_X.X.X_amd64.AppImage.tar.gz.sig`

**Windows :**

- `Pixsaur_X.X.X_x64-setup.exe`
- `Pixsaur_X.X.X_x64-setup.nsis.zip` ← Pour l'updater
- `Pixsaur_X.X.X_x64-setup.nsis.zip.sig`

**macOS :**

- `Pixsaur_X.X.X_aarch64.dmg`
- `Pixsaur_aarch64.app.tar.gz` ← Pour l'updater
- `Pixsaur_aarch64.app.tar.gz.sig`

## 🔍 Vérification

Pour vérifier que tout fonctionne :

```bash
# Après un build local
./scripts/create-updater-archives.sh 0.1.11 linux   # ou macos ou windows

# Vérifier la présence des fichiers
find src-tauri/target -name "*.tar.gz" -o -name "*.zip"

# Vérifier latest.json
./scripts/check-updater-config.sh
```

## 📝 Notes importantes

1. **Tauri v2 vs v1** : C'est un changement de comportement par rapport à Tauri v1 qui générait automatiquement ces archives.

2. **Signatures** : Les signatures sont copiées des fichiers originaux vers les archives. Tauri les a déjà générées avec la clé privée.

3. **Targets requis** :

   - macOS : `app` (pas `dmg`)
   - Linux : `appimage` (pas `deb` ou `rpm`)
   - Windows : `nsis` ou `msi`

4. **Workflow CI/CD** : Le script doit être exécuté APRÈS `pnpm tauri build` mais AVANT l'upload des artifacts.

## 🐛 Troubleshooting

**Problème : Le script échoue sur Windows**

- Solution : Utiliser `shell: bash` dans le workflow

**Problème : Les fichiers .tar.gz ne sont pas créés**

- Vérifier que le script a les permissions d'exécution : `chmod +x scripts/create-updater-archives.sh`
- Vérifier que les fichiers source existent avant compression

**Problème : Les signatures ne sont pas copiées**

- Vérifier que `TAURI_SIGNING_PRIVATE_KEY` est configuré dans les GitHub Secrets
- Les signatures doivent être générées par Tauri avant d'exécuter le script
