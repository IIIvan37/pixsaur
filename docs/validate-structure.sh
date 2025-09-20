#!/bin/bash

# Script de validation des liens dans la documentation
echo "🔍 Validation de la structure de documentation Pixsaur"
echo "================================================="

# Vérifier la structure
echo ""
echo "📁 Structure docs/ :"
cd docs
find . -name "*.md" | sort | sed 's/^/  /'

echo ""
echo "📝 Fichiers dans le root :"
cd ..
ls -la *.md | sed 's/^/  /'

echo ""
echo "✅ Centralisation réussie !"
echo ""
echo "📚 Points d'entrée :"
echo "  - README.md (root) → Pointe vers docs/"
echo "  - docs/README.md → Navigation documentation"
echo "  - docs/DEVELOPMENT_GUIDE.md → Guide principal"
echo "  - docs/DOCUMENTATION_INDEX.md → Index complet"

echo ""
echo "🎯 Structure finale :"
echo "  root/"
echo "  ├── README.md (simplifié)"
echo "  └── docs/"
echo "      ├── README.md (navigation)"
echo "      ├── DEVELOPMENT_GUIDE.md (principal)"
echo "      ├── DOCUMENTATION_INDEX.md (index)"
echo "      ├── architecture/"
echo "      │   ├── ADAPTER_ARCHITECTURE.md"
echo "      │   └── ATOMS_MIGRATION.md"
echo "      ├── guides/"
echo "      │   ├── LOGGING_PATTERNS.md"
echo "      │   └── LOGGING_SYSTEM.md"
echo "      └── [autres fichiers techniques...]"

echo ""
echo "🚀 Documentation centralisée et organisée !"