# Pixsaur

**Image converter for Amstrad CPC** - Web and desktop application with palette quantization, dithering, and multi-format exports.

## Features

- **CPC palette quantization** : 27 colors (Classic) or 4096 colors (Plus)
- **Color spaces** : RGB
- **Dithering and adjustments** : Brightness, contrast, saturation
- **Export** : scr, linear, palette, png...
- **CPU/GPU architecture** : Adaptive processing with fallback

## Download

### Pre-built binaries

Download the latest desktop application for your platform:

- **Windows** : [pixsaur_x.x.x_x64-setup.exe](https://github.com/IIIvan37/pixsaur/releases/latest)
- **macOS** : [pixsaur_x.x.x_x64.dmg](https://github.com/IIIvan37/pixsaur/releases/latest) / [pixsaur_x.x.x_aarch64.dmg](https://github.com/IIIvan37/pixsaur/releases/latest)
- **Linux** : [pixsaur_x.x.x_amd64.AppImage](https://github.com/IIIvan37/pixsaur/releases/latest) / [pixsaur_x.x.x_amd64.deb](https://github.com/IIIvan37/pixsaur/releases/latest) / [pixsaur_x.x.x_x86_64.rpm](https://github.com/IIIvan37/pixsaur/releases/latest)

### Web version

Try the web version online: [https://pixsaur.iiivan.org/](https://pixsaur.iiivan.org/)

## Development

### Quick Setup (Automated)

For **macOS** and **Linux**, we provide an automated setup script that installs everything you need:

```bash
git clone https://github.com/IIIvan37/pixsaur.git
cd pixsaur
./scripts/setup-dev-environment.sh
```

This script will automatically install:

- System dependencies (Xcode CLI Tools for macOS, GTK/WebKit for Linux)
- Node.js (via Homebrew on macOS)
- pnpm
- Rust
- Project dependencies (pnpm install)

**Supported distributions**: Ubuntu, Debian, Linux Mint, Pop!\_OS, Elementary, Arch, Manjaro, Fedora, RHEL, CentOS, openSUSE

After installation, run:

```bash
source $HOME/.cargo/env  # Load Rust environment
pnpm tauri:dev           # Start development
```

### Manual Setup

If you prefer manual installation or are on Windows:

#### Prerequisites

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **pnpm** (v8 or later) - `npm install -g pnpm`
- **Rust** (latest stable) - [Install rustup](https://rustup.rs/)
- **Git** - For cloning the repository

#### Clone the Repository

```bash
git clone https://github.com/IIIvan37/pixsaur.git
cd pixsaur
pnpm install
```

#### System Dependencies

<details>
<summary><strong>macOS</strong></summary>

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Install [Node.js](https://nodejs.org/)
3. Install [Rust](https://rustup.rs/)
4. Install pnpm: `npm install -g pnpm`
5. Restart your terminal

</details>

<details>
<summary><strong>Linux (Ubuntu/Debian)</strong></summary>

```bash
# System dependencies
sudo apt update
sudo apt install build-essential curl wget file libssl-dev pkg-config

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# WebKit2GTK (try 4.1 first, fallback to 4.0)
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev || \
sudo apt install libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev libgtk-3-dev
```

</details>

#### Run Development Server

Desktop app (Tauri):

```bash
pnpm tauri:dev
```

Web version only:

```bash
pnpm dev
# Open http://localhost:5173
```

### Available Scripts

- `pnpm install`: Install project dependencies
- `pnpm dev`: Start the Vite development server for the web version (http://localhost:5173)
- `pnpm build`: Type-check with TypeScript and build the web version (output in dist/)
- `pnpm preview`: Preview the built web version locally
- `pnpm typecheck`: Run TypeScript type checking without emitting files
- `pnpm test`: Run tests with Vitest
- `pnpm test:coverage`: Run tests with coverage report
- `pnpm lint`: Check code linting with Biome
- `pnpm lint:fix`: Fix linting issues automatically
- `pnpm format`: Check code formatting with Biome
- `pnpm format:fix`: Format code automatically
- `pnpm check`: Run full Biome check (lint + format)
- `pnpm check:fix`: Fix all Biome issues automatically
- `pnpm i18n:extract`: Extract internationalization messages with Lingui
- `pnpm i18n:compile`: Compile internationalization messages
- `pnpm tauri`: Run Tauri CLI commands
- `pnpm tauri:dev`: Start Tauri development mode (desktop app)
- `pnpm tauri:build`: Build the desktop application

## Tech Stack

- **React 19** + TypeScript + Vite
- **Jotai** - Atomic state management
- **Tauri 2.9** - Cross-platform desktop
- **pixsaur-color** - Custom colorimetric library (RGB)
- **Biome** - Linting and formatting

## Contribution

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details
