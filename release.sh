#!/bin/bash

# Script de release automatique pour Pixsaur
# Usage: ./release.sh <version>
# Exemple: ./release.sh 0.1.16

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.1.16"
    exit 1
fi

VERSION=$1
BRANCH_NAME="chore/bump-version-${VERSION}"

echo "🚀 Creating Pixsaur release v$VERSION"

# Vérifier qu'on est sur main et à jour
echo "🔍 Checking current branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Must be on main branch (currently on $CURRENT_BRANCH)"
    exit 1
fi

echo "📥 Pulling latest changes..."
git pull --rebase

# Créer une nouvelle branche pour le bump de version
echo "🌿 Creating branch $BRANCH_NAME..."
git checkout -b "$BRANCH_NAME"

# Mettre à jour les versions dans les fichiers
echo "📝 Updating version files..."
jq ".version = \"$VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
jq ".version = \"$VERSION\"" src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json

# Vérifier s'il y a des changements
if ! git diff --quiet package.json src-tauri/tauri.conf.json; then
  # Commiter les changements
  echo "💾 Committing version changes..."
  git add package.json src-tauri/tauri.conf.json
  git commit -m "chore: bump version to $VERSION"

  # Pousser la branche
  echo "⬆️ Pushing branch..."
  git push -u origin "$BRANCH_NAME"

  # Créer et merger la PR
  echo "🔀 Creating and merging PR..."
  gh pr create --title "chore: bump version to $VERSION" --body "Bump version to $VERSION for next release." --base main
  gh pr merge --squash --delete-branch

  # Retourner sur main et pull
  echo "🔄 Returning to main branch..."
  git checkout main
  git pull --rebase

  # Supprimer la branche locale
  echo "🗑️ Cleaning up local branch..."
  git branch -D "$BRANCH_NAME" 2>/dev/null || true
else
  echo "ℹ️  Version already set to $VERSION, skipping PR..."
  git checkout main
  git branch -D "$BRANCH_NAME" 2>/dev/null || true
fi

# Générer le changelog depuis le dernier tag
echo "📝 Generating changelog..."
PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$PREVIOUS_TAG" ]; then
    echo "ℹ️  No previous tag found, generating full changelog..."
    CHANGELOG=$(git log --pretty=format:"- %s" --no-merges)
else
    echo "ℹ️  Generating changelog since $PREVIOUS_TAG..."
    CHANGELOG=$(git log ${PREVIOUS_TAG}..HEAD --pretty=format:"- %s" --no-merges)
fi

# Supprimer le tag existant s'il existe (local et distant)
echo "🏷️ Creating tag v$VERSION..."
git fetch --tags 2>/dev/null || true

# Vérifier le tag local
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "⚠️  Local tag v$VERSION already exists, deleting..."
  git tag -d "v$VERSION"
fi

# Vérifier et supprimer le tag distant
if git ls-remote --tags origin | grep -q "refs/tags/v$VERSION"; then
  echo "⚠️  Remote tag v$VERSION already exists, deleting..."
  git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
fi

# Créer et pousser le tag avec le changelog
git tag -a "v$VERSION" -m "Release v$VERSION

## Changes

$CHANGELOG"
git push origin "v$VERSION"

echo ""
echo "✅ Release v$VERSION created!"
echo ""
echo "📋 Changelog:"
echo "$CHANGELOG"
echo ""
echo "🚀 GitHub Actions workflow is now building the release assets."
echo "📦 The release will be created automatically as draft."
echo ""
echo "Monitor the workflow at:"
echo "https://github.com/IIIvan37/pixsaur/actions"