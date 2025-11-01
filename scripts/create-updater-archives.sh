#!/bin/bash
# Script pour créer les archives updater nécessaires pour Tauri v2
# Tauri v2 ne génère plus automatiquement les .tar.gz et .zip, il faut les créer manuellement

set -e

VERSION=$1
PLATFORM=$2

echo "Creating updater archives for version ${VERSION} on ${PLATFORM}"

if [ "$PLATFORM" = "linux" ]; then
    echo "Processing Linux AppImage..."
    cd src-tauri/target/release/bundle/appimage
    
    for appimage in *.AppImage; do
        if [ -f "$appimage" ]; then
            echo "Creating ${appimage}.tar.gz"
            tar -czf "${appimage}.tar.gz" "$appimage"
            
            # Si une signature existe pour l'AppImage original, on la copie
            if [ -f "${appimage}.sig" ]; then
                echo "Copying signature to ${appimage}.tar.gz.sig"
                cp "${appimage}.sig" "${appimage}.tar.gz.sig"
            fi
        fi
    done
    
elif [ "$PLATFORM" = "macos" ]; then
    echo "Processing macOS .app bundles..."
    cd src-tauri/target/release/bundle/macos
    
    for app in *.app; do
        if [ -d "$app" ]; then
            appname=$(basename "$app" .app)
            echo "Creating ${appname}.app.tar.gz"
            tar -czf "${appname}.app.tar.gz" "$app"
            
            # Tauri devrait déjà avoir créé la signature pour .app.tar.gz
            # Si pas, on la génère (nécessite la clé privée)
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
            
            # Si une signature existe pour l'exe original, on la copie
            if [ -f "${exe}.sig" ]; then
                echo "Copying signature to ${zipname}.sig"
                cp "${exe}.sig" "${zipname}.sig"
            fi
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
                
                if [ -f "${msi}.sig" ]; then
                    echo "Copying signature to ${zipname}.sig"
                    cp "${msi}.sig" "${zipname}.sig"
                fi
            fi
        done
    fi
fi

echo "Updater archives created successfully!"
