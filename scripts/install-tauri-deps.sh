#!/bin/bash
set -e

echo "🦖 Pixsaur Desktop - Installation des dépendances Tauri"
echo "========================================================="
echo ""

# Détecter la distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "❌ Impossible de détecter la distribution Linux"
    exit 1
fi

echo "📋 Distribution détectée: $OS $VERSION"
echo ""

# Vérifier si sudo est disponible
if ! command -v sudo &> /dev/null; then
    echo "❌ sudo n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

install_ubuntu_debian() {
    echo "📦 Installation des dépendances pour Ubuntu/Debian..."
    
    # Mettre à jour la liste des paquets
    echo "🔄 Mise à jour de la liste des paquets..."
    sudo apt update
    
    # Essayer d'installer libwebkit2gtk-4.1-dev d'abord (Ubuntu 24.04+)
    if sudo apt-cache show libwebkit2gtk-4.1-dev &> /dev/null; then
        echo "✅ Installation de libwebkit2gtk-4.1-dev (version moderne)"
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
    else
        echo "⚠️  libwebkit2gtk-4.1-dev non disponible, utilisation de la version 4.0"
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
    fi
}

install_arch() {
    echo "📦 Installation des dépendances pour Arch Linux..."
    sudo pacman -Syu --needed --noconfirm \
        webkit2gtk-4.1 \
        base-devel \
        curl \
        wget \
        file \
        openssl \
        appmenu-gtk-module \
        gtk3 \
        libappindicator-gtk3 \
        librsvg \
        pkgconf
}

install_fedora() {
    echo "📦 Installation des dépendances pour Fedora..."
    sudo dnf install -y \
        pkg-config \
        webkit2gtk4.1-devel \
        openssl-devel \
        curl \
        wget \
        file \
        libappindicator-gtk3-devel \
        librsvg2-devel
}

install_opensuse() {
    echo "📦 Installation des dépendances pour openSUSE..."
    sudo zypper install -y \
        pkg-config \
        webkit2gtk3-devel \
        libopenssl-devel \
        curl \
        wget \
        file \
        libappindicator3-devel \
        librsvg-devel
}

# Installation selon la distribution
case "$OS" in
    ubuntu|debian|linuxmint|pop)
        install_ubuntu_debian
        ;;
    arch|manjaro|endeavouros)
        install_arch
        ;;
    fedora|rhel|centos)
        install_fedora
        ;;
    opensuse|opensuse-leap|opensuse-tumbleweed)
        install_opensuse
        ;;
    *)
        echo "❌ Distribution non supportée: $OS"
        echo ""
        echo "Veuillez installer manuellement les dépendances suivantes:"
        echo "  - pkg-config"
        echo "  - webkit2gtk-4.1 (ou webkit2gtk-4.0)"
        echo "  - build-essential / base-devel"
        echo "  - curl, wget, file"
        echo "  - libssl-dev / openssl-devel"
        echo "  - libappindicator3-dev"
        echo "  - librsvg2-dev"
        exit 1
        ;;
esac

echo ""
echo "✅ Dépendances système installées avec succès!"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Assurez-vous que Rust est installé:"
echo "     source \$HOME/.cargo/env"
echo "     rustc --version"
echo ""
echo "  2. Lancez l'application desktop:"
echo "     cd $(pwd)"
echo "     pnpm tauri:dev"
echo ""
echo "  3. Pour créer un build de production:"
echo "     pnpm tauri:build"
echo ""
echo "🦖 Pixsaur Desktop est prêt!"
