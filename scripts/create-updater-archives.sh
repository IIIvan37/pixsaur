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
            
            # Utiliser zip standard en priorité (le plus compatible avec Tauri)
            if command -v zip &> /dev/null; then
                # zip standard avec compression normale (store ou deflate level 6)
                zip -6 "$zipname" "$exe"
            elif command -v 7z &> /dev/null; then
                # 7z avec méthode Deflate et niveau de compression normal
                7z a -tzip -mm=Deflate -mx=6 "$zipname" "$exe"
            elif command -v powershell.exe &> /dev/null; then
                # PowerShell en dernier recours
                powershell.exe -Command "Compress-Archive -Path '$exe' -DestinationPath '$zipname' -CompressionLevel Optimal -Force"
            else
                echo "Error: No compression tool available (tried zip, 7z, powershell)"
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
                
                if command -v zip &> /dev/null; then
                    # zip standard avec compression normale
                    zip -6 "$zipname" "$msi"
                elif command -v 7z &> /dev/null; then
                    # 7z avec méthode Deflate et niveau normal
                    7z a -tzip -mm=Deflate -mx=6 "$zipname" "$msi"
                elif command -v powershell.exe &> /dev/null; then
                    powershell.exe -Command "Compress-Archive -Path '$msi' -DestinationPath '$zipname' -CompressionLevel Optimal -Force"
                else
                    echo "Error: No compression tool available (tried zip, 7z, powershell)"
                    exit 1
                fi
                
                # Re-signer l'archive MSI
                sign_file "${zipname}"
            fi
        done
    fi
fi

echo "Updater archives created successfully!"
