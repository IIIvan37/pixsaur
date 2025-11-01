#!/bin/bash

# Script de vérification de la configuration de l'updater
# Pour macOS Apple Silicon

echo "🔍 Vérification de la configuration de l'updater Pixsaur..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de vérification
check_item() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
  else
    echo -e "${RED}✗${NC} $2"
  fi
}

# 1. Vérifier la présence de latest.json
echo "1️⃣  Vérification du fichier latest.json..."
LATEST_JSON_URL="https://github.com/IIIvan37/pixsaur/releases/latest/download/latest.json"
LATEST_JSON=$(curl -s -w "%{http_code}" -o /tmp/pixsaur_latest.json "$LATEST_JSON_URL")

if [ "$LATEST_JSON" = "200" ]; then
  check_item 0 "latest.json accessible"
  
  # Vérifier le contenu
  if command -v jq &> /dev/null; then
    VERSION=$(jq -r '.version' /tmp/pixsaur_latest.json 2>/dev/null)
    DARWIN_AARCH64=$(jq -r '.platforms."darwin-aarch64".url' /tmp/pixsaur_latest.json 2>/dev/null)
    SIGNATURE=$(jq -r '.platforms."darwin-aarch64".signature' /tmp/pixsaur_latest.json 2>/dev/null)
    
    echo "   Version détectée: ${YELLOW}$VERSION${NC}"
    
    if [ "$DARWIN_AARCH64" != "null" ] && [ -n "$DARWIN_AARCH64" ]; then
      check_item 0 "Plateforme darwin-aarch64 présente"
      echo "   URL: $DARWIN_AARCH64"
    else
      check_item 1 "Plateforme darwin-aarch64 manquante"
    fi
    
    if [ "$SIGNATURE" != "null" ] && [ -n "$SIGNATURE" ]; then
      check_item 0 "Signature présente"
    else
      check_item 1 "Signature manquante"
    fi
  else
    echo -e "   ${YELLOW}⚠${NC} jq non installé, impossible de vérifier le contenu"
    echo "   Installez jq: brew install jq"
  fi
else
  check_item 1 "latest.json non accessible (HTTP $LATEST_JSON)"
fi

echo ""

# 2. Vérifier les bundles pour toutes les plateformes
if [ -f /tmp/pixsaur_latest.json ] && command -v jq &> /dev/null; then
  echo "2️⃣  Vérification des bundles updater..."
  
  # macOS Apple Silicon
  DARWIN_AARCH64_URL=$(jq -r '.platforms."darwin-aarch64".url' /tmp/pixsaur_latest.json 2>/dev/null)
  if [ "$DARWIN_AARCH64_URL" != "null" ] && [ -n "$DARWIN_AARCH64_URL" ]; then
    if [[ "$DARWIN_AARCH64_URL" == *.app.tar.gz ]]; then
      BUNDLE_CHECK=$(curl -s -I -w "%{http_code}" -o /dev/null "$DARWIN_AARCH64_URL")
      if [ "$BUNDLE_CHECK" = "200" ] || [ "$BUNDLE_CHECK" = "302" ]; then
        check_item 0 "macOS Apple Silicon (.app.tar.gz) accessible"
      else
        check_item 1 "macOS Apple Silicon non accessible (HTTP $BUNDLE_CHECK)"
      fi
    else
      check_item 1 "macOS Apple Silicon: mauvais format (devrait être .app.tar.gz)"
      echo "   Trouvé: $DARWIN_AARCH64_URL"
    fi
  fi
  
  # Linux
  LINUX_URL=$(jq -r '.platforms."linux-x86_64".url' /tmp/pixsaur_latest.json 2>/dev/null)
  if [ "$LINUX_URL" != "null" ] && [ -n "$LINUX_URL" ]; then
    if [[ "$LINUX_URL" == *.AppImage.tar.gz ]]; then
      BUNDLE_CHECK=$(curl -s -I -w "%{http_code}" -o /dev/null "$LINUX_URL")
      if [ "$BUNDLE_CHECK" = "200" ] || [ "$BUNDLE_CHECK" = "302" ]; then
        check_item 0 "Linux (.AppImage.tar.gz) accessible"
      else
        check_item 1 "Linux non accessible (HTTP $BUNDLE_CHECK)"
      fi
    else
      check_item 1 "Linux: mauvais format (devrait être .AppImage.tar.gz)"
      echo "   Trouvé: $LINUX_URL"
    fi
  fi
  
  # Windows
  WINDOWS_URL=$(jq -r '.platforms."windows-x86_64".url' /tmp/pixsaur_latest.json 2>/dev/null)
  if [ "$WINDOWS_URL" != "null" ] && [ -n "$WINDOWS_URL" ]; then
    if [[ "$WINDOWS_URL" == *.nsis.zip ]]; then
      BUNDLE_CHECK=$(curl -s -I -w "%{http_code}" -o /dev/null "$WINDOWS_URL")
      if [ "$BUNDLE_CHECK" = "200" ] || [ "$BUNDLE_CHECK" = "302" ]; then
        check_item 0 "Windows (.nsis.zip) accessible"
      else
        check_item 1 "Windows non accessible (HTTP $BUNDLE_CHECK)"
      fi
    else
      check_item 1 "Windows: mauvais format (devrait être .nsis.zip)"
      echo "   Trouvé: $WINDOWS_URL"
    fi
  fi
fi

echo ""

# 3. Vérifier la configuration locale
echo "3️⃣  Vérification de la configuration locale..."

if [ -f "src-tauri/tauri.conf.json" ]; then
  check_item 0 "tauri.conf.json présent"
  
  # Vérifier la configuration updater
  if command -v jq &> /dev/null; then
    UPDATER_ENDPOINT=$(jq -r '.plugins.updater.endpoints[0]' src-tauri/tauri.conf.json 2>/dev/null)
    PUBKEY=$(jq -r '.plugins.updater.pubkey' src-tauri/tauri.conf.json 2>/dev/null)
    CREATE_ARTIFACTS=$(jq -r '.bundle.createUpdaterArtifacts' src-tauri/tauri.conf.json 2>/dev/null)
    
    if [ "$UPDATER_ENDPOINT" = "$LATEST_JSON_URL" ]; then
      check_item 0 "Endpoint updater correct"
    else
      check_item 1 "Endpoint updater incorrect"
      echo "   Attendu: $LATEST_JSON_URL"
      echo "   Trouvé: $UPDATER_ENDPOINT"
    fi
    
    if [ -n "$PUBKEY" ] && [ "$PUBKEY" != "null" ]; then
      check_item 0 "Clé publique configurée"
    else
      check_item 1 "Clé publique manquante"
    fi
    
    if [ "$CREATE_ARTIFACTS" = "true" ]; then
      check_item 0 "createUpdaterArtifacts activé"
    else
      check_item 1 "createUpdaterArtifacts désactivé"
    fi
  fi
else
  check_item 1 "tauri.conf.json non trouvé"
fi

echo ""

# 4. Vérifier l'architecture du Mac
echo "4️⃣  Informations système..."
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  check_item 0 "Mac Apple Silicon détecté (arm64)"
else
  echo -e "${YELLOW}⚠${NC} Mac Intel détecté ($ARCH)"
  echo "   L'updater devrait chercher darwin-x86_64 au lieu de darwin-aarch64"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$LATEST_JSON" != "200" ]; then
  echo -e "${RED}❌ PROBLÈME PRINCIPAL${NC}"
  echo "Le fichier latest.json n'est pas accessible."
  echo "Vérifiez que la release est publiée sur GitHub."
  echo ""
  echo "Actions à faire :"
  echo "  1. Créer une nouvelle release sur GitHub"
  echo "  2. Uploader les fichiers générés par 'pnpm tauri build'"
  echo "  3. Uploader le fichier latest.json"
else
  # Vérifier si les URLs ont le bon format
  HAS_FORMAT_ERROR=false
  if [ -f /tmp/pixsaur_latest.json ] && command -v jq &> /dev/null; then
    DARWIN_URL=$(jq -r '.platforms."darwin-aarch64".url' /tmp/pixsaur_latest.json 2>/dev/null)
    LINUX_URL=$(jq -r '.platforms."linux-x86_64".url' /tmp/pixsaur_latest.json 2>/dev/null)
    WINDOWS_URL=$(jq -r '.platforms."windows-x86_64".url' /tmp/pixsaur_latest.json 2>/dev/null)
    
    if [[ "$DARWIN_URL" != *.app.tar.gz ]] || [[ "$LINUX_URL" != *.AppImage.tar.gz ]] || [[ "$WINDOWS_URL" != *.nsis.zip ]]; then
      HAS_FORMAT_ERROR=true
    fi
  fi
  
  if [ "$HAS_FORMAT_ERROR" = true ]; then
    echo -e "${RED}❌ PROBLÈME PRINCIPAL${NC}"
    echo "Le fichier latest.json pointe vers les mauvais formats de fichiers."
    echo ""
    echo "L'updater a besoin de :"
    echo "  • macOS: .app.tar.gz (pas .dmg)"
    echo "  • Linux: .AppImage.tar.gz (pas .AppImage)"
    echo "  • Windows: .nsis.zip (pas .exe)"
    echo ""
    echo "Actions à faire :"
    echo "  1. Générer le bon latest.json :"
    echo "     ./scripts/generate-latest-json.sh"
    echo "  2. Builder et uploader les bons fichiers"
    echo "  3. Consulter UPDATER_FIX.md pour les détails"
  else
    echo -e "${GREEN}✅ Configuration correcte !${NC}"
    echo ""
    echo "Si l'updater ne fonctionne toujours pas :"
    echo "  1. Vérifiez les logs dans l'app (F12)"
    echo "  2. Testez avec la nouvelle version qui affiche les erreurs"
    echo "  3. Consultez UPDATER_FIX.md pour plus de détails"
  fi
fi

echo ""

# Nettoyage
rm -f /tmp/pixsaur_latest.json
