#!/bin/bash
# Script pour créer les archives updater nécessaires pour Tauri v2
# Tauri v2 ne génère plus automatiquement les .tar.gz et .zip, il faut les créer manuellement

set -e

VERSION=$1
PLATFORM=$2

echo "Creating updater archives for version ${VERSION} on ${PLATFORM}"

# Fonction pour signer un fichier avec la clé Tauri
sign_file() {
    local file=$1
    if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
        echo "Warning: TAURI_SIGNING_PRIVATE_KEY not set, skipping signature"
        return
    fi
    
    echo "Signing ${file}..."
    # Utiliser pnpm tauri signer (installé via @tauri-apps/cli)
    # On doit retourner au répertoire racine du projet pour que pnpm fonctionne
    local current_dir=$(pwd)
    local project_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
    
    cd "$project_root"
    if command -v pnpm &> /dev/null; then
        echo "$TAURI_SIGNING_PRIVATE_KEY" | pnpm tauri signer sign "${current_dir}/${file}" --private-key-path /dev/stdin
    else
        echo "Warning: pnpm not found, cannot sign file"
    fi
    cd "$current_dir"
}

if [ "$PLATFORM" = "linux" ]; then
    echo "Processing Linux AppImage..."
    cd src-tauri/target/release/bundle/appimage
    
    for appimage in *.AppImage; do
        if [ -f "$appimage" ]; then
            tarfile="${appimage}.tar.gz"
            echo "Creating ${tarfile}"
            tar -czf "${tarfile}" "$appimage"
            
            # Re-signer l'archive (pas l'original)
            sign_file "${tarfile}"
        fi
    done
    
elif [ "$PLATFORM" = "macos" ]; then
    echo "Processing macOS .app bundles..."
    
    # Détecter l'architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        ARCH_SUFFIX="_aarch64"
    elif [ "$ARCH" = "x86_64" ]; then
        ARCH_SUFFIX="_x64"
    else
        ARCH_SUFFIX=""
    fi
    
    cd src-tauri/target/release/bundle/macos
    
    for app in *.app; do
        if [ -d "$app" ]; then
            appname=$(basename "$app" .app)
            tarname="${appname}${ARCH_SUFFIX}.app.tar.gz"
            echo "Creating ${tarname}"
            tar -czf "${tarname}" "$app"
            
            # Re-signer l'archive
            sign_file "${tarname}"
        fi
    done
    
elif [ "$PLATFORM" = "windows" ]; then
    echo "Processing Windows NSIS installers..."
    cd src-tauri/target/release/bundle/nsis
    
    for exe in *-setup.exe; do
        if [ -f "$exe" ]; then
            zipname="${exe%.exe}.nsis.zip"
            echo "Creating ${zipname}"
            
            # Utiliser PowerShell sur Windows (disponible dans Git Bash)
            if command -v powershell.exe &> /dev/null; then
                powershell.exe -Command "Compress-Archive -Path '$exe' -DestinationPath '$zipname' -Force"
            elif command -v 7z &> /dev/null; then
                7z a "$zipname" "$exe"
            else
                echo "Error: No compression tool available (tried powershell, 7z)"
                exit 1
            fi
            
            # Re-signer l'archive
            sign_file "${zipname}"
        fi
    done
    
    # MSI (si nécessaire)
    if [ -d "../msi" ]; then
        cd ../msi
        for msi in *.msi; do
            if [ -f "$msi" ]; then
                zipname="${msi}.zip"
                echo "Creating ${zipname}"
                
                if command -v powershell.exe &> /dev/null; then
                    powershell.exe -Command "Compress-Archive -Path '$msi' -DestinationPath '$zipname' -Force"
                elif command -v 7z &> /dev/null; then
                    7z a "$zipname" "$msi"
                else
                    echo "Error: No compression tool available (tried powershell, 7z)"
                    exit 1
                fi
                
                # Re-signer l'archive MSI
                sign_file "${zipname}"
            fi
        done
    fi
fi

echo "Updater archives created successfully!"
