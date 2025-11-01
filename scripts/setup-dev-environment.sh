#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Pixsaur Desktop - Complete Development Environment Setup${NC}"
echo "========================================================="
echo "This script will install all required dependencies:"
echo "  • System dependencies (Xcode CLI Tools / GTK / WebKit)"
echo "  • Node.js (if not installed)"
echo "  • pnpm (if not installed)"
echo "  • Rust (if not installed)"
echo "  • Project dependencies (pnpm install)"
echo ""

# Detect operating system
OS_TYPE=$(uname -s)

if [ "$OS_TYPE" = "Darwin" ]; then
    OS="macos"
    VERSION=$(sw_vers -productVersion)
    echo -e "${GREEN}Detected: macOS $VERSION${NC}"
elif [ "$OS_TYPE" = "Linux" ]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        echo -e "${GREEN}Detected distribution: $OS $VERSION${NC}"
    else
        echo -e "${RED}Error: Unable to detect Linux distribution${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: Unsupported operating system: $OS_TYPE${NC}"
    echo "This script supports macOS and Linux only."
    echo "For Windows, please see: https://v2.tauri.app/start/prerequisites/"
    exit 1
fi

echo ""

# Check if running as root (skip check on macOS as it's less common)
if [ "$OS" != "macos" ] && [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}Warning: Running as root. It's recommended to run this script as a regular user.${NC}"
    echo ""
fi

install_ubuntu_debian() {
    echo -e "${BLUE}Installing dependencies for Ubuntu/Debian...${NC}"
    
    # Update package list
    echo -e "${YELLOW}Updating package list...${NC}"
    sudo apt update
    
    # Try to install libwebkit2gtk-4.1-dev first (Ubuntu 24.04+)
    if sudo apt-cache show libwebkit2gtk-4.1-dev &> /dev/null; then
        echo -e "${GREEN}Installing libwebkit2gtk-4.1-dev (modern version)${NC}"
        sudo apt install -y \
            pkg-config \
            libwebkit2gtk-4.1-dev \
            build-essential \
            curl \
            wget \
            file \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            libgtk-3-dev
    else
        echo -e "${YELLOW}libwebkit2gtk-4.1-dev not available, using version 4.0${NC}"
        sudo apt install -y \
            pkg-config \
            libwebkit2gtk-4.0-dev \
            build-essential \
            curl \
            wget \
            file \
            libssl-dev \
            libappindicator3-dev \
            librsvg2-dev \
            libgtk-3-dev
    fi
}

install_macos() {
    echo -e "${BLUE}Installing dependencies for macOS...${NC}"
    
    # Check if Xcode Command Line Tools are installed
    if ! xcode-select -p &> /dev/null; then
        echo -e "${YELLOW}Xcode Command Line Tools not found. Installing...${NC}"
        xcode-select --install
        echo ""
        echo -e "${YELLOW}Please wait for Xcode Command Line Tools installation to complete,${NC}"
        echo -e "${YELLOW}then run this script again.${NC}"
        exit 0
    else
        echo -e "${GREEN}✓ Xcode Command Line Tools are installed${NC}"
    fi
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Homebrew not found. Installing...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [ -f /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    else
        echo -e "${GREEN}✓ Homebrew is installed${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}All macOS dependencies are ready!${NC}"
    echo -e "${YELLOW}Note: No additional packages needed for Tauri on macOS${NC}"
}

install_arch() {
    echo -e "${BLUE}Installing dependencies for Arch Linux...${NC}"
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
    echo -e "${BLUE}Installing dependencies for Fedora...${NC}"
    sudo dnf install -y \
        pkg-config \
        webkit2gtk4.1-devel \
        openssl-devel \
        curl \
        wget \
        file \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        gtk3-devel
}

install_opensuse() {
    echo -e "${BLUE}Installing dependencies for openSUSE...${NC}"
    sudo zypper install -y \
        pkg-config \
        webkit2gtk3-devel \
        libopenssl-devel \
        curl \
        wget \
        file \
        libappindicator3-devel \
        librsvg-devel \
        gtk3-devel
}

# Install dependencies based on OS/distribution
case "$OS" in
    macos)
        install_macos
        ;;
    ubuntu|debian|linuxmint|pop|elementary)
        # Check if sudo is available
        if ! command -v sudo &> /dev/null; then
            echo -e "${RED}Error: sudo is not installed. Please install it first.${NC}"
            exit 1
        fi
        install_ubuntu_debian
        ;;
    arch|manjaro|endeavouros|garuda)
        if ! command -v sudo &> /dev/null; then
            echo -e "${RED}Error: sudo is not installed. Please install it first.${NC}"
            exit 1
        fi
        install_arch
        ;;
    fedora|rhel|centos|rocky|almalinux)
        if ! command -v sudo &> /dev/null; then
            echo -e "${RED}Error: sudo is not installed. Please install it first.${NC}"
            exit 1
        fi
        install_fedora
        ;;
    opensuse|opensuse-leap|opensuse-tumbleweed)
        if ! command -v sudo &> /dev/null; then
            echo -e "${RED}Error: sudo is not installed. Please install it first.${NC}"
            exit 1
        fi
        install_opensuse
        ;;
    *)
        echo -e "${RED}Error: Unsupported distribution: $OS${NC}"
        echo ""
        echo "Please install the following dependencies manually:"
        echo "  - pkg-config"
        echo "  - webkit2gtk-4.1 (or webkit2gtk-4.0)"
        echo "  - build-essential / base-devel"
        echo "  - curl, wget, file"
        echo "  - libssl-dev / openssl-devel"
        echo "  - libappindicator3-dev"
        echo "  - librsvg2-dev"
        echo "  - libgtk-3-dev / gtk3-devel"
        echo ""
        echo "See: https://v2.tauri.app/start/prerequisites/"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ System dependencies installed successfully!${NC}"
echo ""

# Install Node.js (if not present)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    
    if [ "$OS" = "macos" ]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo -e "${RED}Error: Homebrew is required to install Node.js${NC}"
            echo "Install it from: https://brew.sh/"
            exit 1
        fi
    else
        echo -e "${YELLOW}Please install Node.js manually from: https://nodejs.org/${NC}"
        echo "Or use your package manager (apt, dnf, pacman, etc.)"
        exit 1
    fi
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION is installed${NC}"
fi

# Install pnpm via corepack (if not present)
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing via corepack...${NC}"
    
    if command -v corepack &> /dev/null; then
        # Enable corepack and install pnpm
        corepack enable
        corepack prepare pnpm@latest --activate
        echo -e "${GREEN}✓ pnpm installed via corepack${NC}"
    elif command -v npm &> /dev/null; then
        # Fallback: enable corepack first, then use it
        echo -e "${YELLOW}Enabling corepack...${NC}"
        npm install -g corepack || corepack enable
        corepack enable
        corepack prepare pnpm@latest --activate
        echo -e "${GREEN}✓ pnpm installed via corepack${NC}"
    else
        echo -e "${RED}Error: Neither corepack nor npm is available${NC}"
        exit 1
    fi
else
    PNPM_VERSION=$(pnpm --version)
    echo -e "${GREEN}✓ pnpm $PNPM_VERSION is installed${NC}"
fi

# Install Rust (if not present)
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}Rust not found. Installing...${NC}"
    echo ""
    
    # Download and run rustup installer
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    
    # Source cargo environment
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
        echo -e "${GREEN}✓ Rust installed successfully${NC}"
    else
        echo -e "${YELLOW}Rust installed. Please run: source \$HOME/.cargo/env${NC}"
    fi
else
    RUST_VERSION=$(rustc --version | awk '{print $2}')
    echo -e "${GREEN}✓ Rust $RUST_VERSION is installed${NC}"
fi

echo ""
echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}All dependencies are now installed!${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo ""

# Install project dependencies
if [ -f "package.json" ]; then
    echo -e "${BLUE}Installing project dependencies...${NC}"
    pnpm install
    echo ""
fi

echo -e "${BLUE}Next steps:${NC}"
echo "  1. If this is a new terminal, source Rust environment:"
echo "     source \$HOME/.cargo/env"
echo ""
echo "  2. Run the desktop app:"
echo "     pnpm tauri:dev"
echo ""
echo "  3. Build for production:"
echo "     pnpm tauri:build"
echo ""
echo -e "${GREEN}Pixsaur Desktop is ready! 🦖${NC}"
