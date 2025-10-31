#!/bin/bash

# Script de release automatique pour Pixsaur
# Usage: ./release.sh <version> [draft]
# Exemple: ./release.sh 0.1.16 draft

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version> [draft]"
    echo "Example: $0 0.1.16 draft"
    exit 1
fi

VERSION=$1
DRAFT_FLAG=${2:-"release"}

echo "🚀 Creating Pixsaur release v$VERSION"

# Mettre à jour les versions dans les fichiers
echo "📝 Updating version files..."
jq ".version = \"$VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
jq ".version = \"$VERSION\"" src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json

# Commiter les changements
echo "💾 Committing version changes..."
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to $VERSION" || echo "No changes to commit"

# Pousser les changements
echo "⬆️ Pushing changes..."
git push

# Créer le tag
echo "🏷️ Creating tag v$VERSION..."
git tag "v$VERSION"
git push origin "v$VERSION"

echo "✅ Release v$VERSION created!"
echo ""
echo "Le workflow GitHub Actions va maintenant construire les assets pour toutes les plateformes."
echo "La release sera créée automatiquement en draft."

if [ "$DRAFT_FLAG" = "draft" ]; then
    echo "📋 Release will be created as DRAFT"
else
    echo "🚀 Release will be published immediately"
fi