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
    local project_root="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo ".")}"
    
    cd "$project_root"
    if command -v pnpm &> /dev/null; then
        # Créer un fichier temporaire pour la clé privée (stdin ne fonctionne pas bien en CI)
        local temp_key=$(mktemp)
        printf "%s" "$TAURI_SIGNING_PRIVATE_KEY" > "$temp_key"
        
        # Signer le fichier avec la clé depuis le fichier temporaire avec mot de passe vide
        # Important: utiliser --password "" (avec double quotes) pour mot de passe vide
        if pnpm tauri signer sign "${current_dir}/${file}" --private-key-path "$temp_key" --password ""; then
            echo "✓ Signature created: ${file}.sig"
        else
            echo "✗ Failed to sign ${file}"
            rm -f "$temp_key"
            exit 1
        fi
        
        # Vérifier que le fichier .sig a été créé
        if [ ! -f "${current_dir}/${file}.sig" ]; then
            echo "✗ Signature file not found: ${file}.sig"
            rm -f "$temp_key"
            exit 1
        fi
        
        # Supprimer le fichier temporaire
        rm -f "$temp_key"
    else
        echo "Warning: pnpm not found, cannot sign file"
    fi
    cd "$current_dir"
}

if [ "$PLATFORM" = "linux" ]; then
    echo "Processing Linux AppImage..."
    
    # Sauvegarder le chemin du projet AVANT de changer de répertoire
    PROJECT_ROOT=$(pwd)
    export PROJECT_ROOT
    
    # Support both default target/ and custom CARGO_TARGET_DIR (e.g., /tmp/cargo-target)
    if [ -d "/tmp/cargo-target/release/bundle/appimage" ]; then
        cd /tmp/cargo-target/release/bundle/appimage
    else
        cd src-tauri/target/release/bundle/appimage
    fi
    
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
            # Include version in filename: Pixsaur_1.0.0_x64.app.tar.gz
            tarname="${appname}_${VERSION}${ARCH_SUFFIX}.app.tar.gz"
            echo "Creating ${tarname}"
            tar -czf "${tarname}" "$app"
            
            # Re-signer l'archive
            sign_file "${tarname}"
        fi
    done
    
elif [ "$PLATFORM" = "windows" ]; then
    echo "Processing Windows installers..."
    echo "Note: Tauri v2 with createUpdaterArtifacts=true uses .exe and .msi files directly"
    echo "No zip compression needed - signing installers directly"
    
    # Sign NSIS installer
    cd src-tauri/target/release/bundle/nsis
    for exe in *-setup.exe; do
        if [ -f "$exe" ]; then
            echo "Signing ${exe} directly (no zip needed for Tauri v2)"
            sign_file "${exe}"
        fi
    done
    
    # Sign MSI installer
    if [ -d "../msi" ]; then
        cd ../msi
        for msi in *.msi; do
            if [ -f "$msi" ]; then
                echo "Signing ${msi} directly (no zip needed for Tauri v2)"
                sign_file "${msi}"
            fi
        done
    fi
fi

echo "Updater archives created successfully!"
