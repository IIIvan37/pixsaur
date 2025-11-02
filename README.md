# Pixsaur

**Image converter for Amstrad CPC**

Transform modern images into authentic Amstrad CPC graphics with advanced palette quantization, dithering algorithms, and multiple export formats.

[Try Web Version](https://pixsaur.iiivan.org/) • [Download Desktop App](https://github.com/IIIvan37/pixsaur/releases/latest) • [Report Bug](https://github.com/IIIvan37/pixsaur/issues)

---

## Features

### CPC Palette Support

- **Classic CPC**: 27 colors mode for authentic retro graphics
- **CPC Plus**: 4096 colors palette for enhanced visuals
- Real-time palette quantization with perceptual color matching

### Image Processing

- **Multiple dithering algorithms**: Floyd-Steinberg, Atkinson, Sierra, and more
- **Adjustments**: Brightness, contrast, saturation controls
- **Adaptive processing**: Automatic CPU/GPU fallback for optimal performance

### Export Formats

- **SCR**: Native Amstrad CPC screen format
- **Linear**: Raw pixel data
- **Palette**: Color palette extraction
- **PNG**: Preview with applied effects
- And more...

### Multi-Platform

- **Desktop app**: Windows, macOS (Intel & Apple Silicon), Linux (AppImage, deb, rpm)
- **Web version**: Works in any modern browser
- **Auto-updates**: Built-in updater keeps your desktop app current

## Installation

### Desktop Application

Download the latest version for your platform:

| Platform                | Download                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows**             | [.exe installer](https://github.com/IIIvan37/pixsaur/releases/latest) (recommended) or [.msi package](https://github.com/IIIvan37/pixsaur/releases/latest)                                                |
| **macOS Intel**         | [.dmg](https://github.com/IIIvan37/pixsaur/releases/latest) (x64)                                                                                                                                         |
| **macOS Apple Silicon** | [.dmg](https://github.com/IIIvan37/pixsaur/releases/latest) (M1/M2/M3)                                                                                                                                    |
| **Linux**               | [.AppImage](https://github.com/IIIvan37/pixsaur/releases/latest) (universal) or [.deb](https://github.com/IIIvan37/pixsaur/releases/latest) / [.rpm](https://github.com/IIIvan37/pixsaur/releases/latest) |

> **Tip**: The desktop app includes automatic updates! You'll be notified when new versions are available.

### Web Version

No installation required! Try Pixsaur directly in your browser:

**[pixsaur.iiivan.org](https://pixsaur.iiivan.org/)**

Works on any device with a modern web browser.

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

### Frontend

- **React 19** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Jotai** - Atomic state management

### Desktop

- **Tauri 2** - Lightweight cross-platform framework
- **Rust** - High-performance backend

### Image Processing

- **pixsaur-color** - Custom colorimetric library (RGB color space)
- **WebGL** - GPU-accelerated processing with CPU fallback

### Code Quality

- **Biome** - Ultra-fast linting and formatting
- **Vitest** - Unit testing framework
- **TypeScript** - Static type checking

## Contributing

We welcome contributions! Whether it's:

- Bug reports
- Feature requests
- Documentation improvements
- Code contributions

Please read our [Contributing Guide](./CONTRIBUTING.md) to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

Made for the Amstrad CPC community
