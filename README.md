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
- **macOS** : [pixsaur_x.x.x_x64.dmg](https://github.com/IIIvan37/pixsaur/releases/latest)
- **Linux** : [pixsaur_x.x.x_amd64.deb](https://github.com/IIIvan37/pixsaur/releases/latest) / [pixsaur_x.x.x_x86_64.rpm](https://github.com/IIIvan37/pixsaur/releases/latest)

> **Note:** AppImage is not supported for now due to compatibility issues. Use the DEB or RPM package for Linux.

### Web version

Try the web version online: [https://pixsaur.iiivan.org/](https://pixsaur.iiivan.org/)

## Development

### System Dependencies for Tauri

Before starting desktop development with Tauri, install the following dependencies based on your platform.

#### Linux (Debian/Ubuntu)

Run the installation script:
```bash
./scripts/install-tauri-deps.sh
```

This script will automatically detect your distribution and install all required dependencies.

If you prefer manual installation:
```bash
sudo apt update
sudo apt install build-essential curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
sudo apt install libgtk-3-dev libglib2.0-dev pkg-config libwebkit2gtk-4.1-dev
```

If you use another distribution, install the equivalents of: GTK3, GLib2, pkg-config, build-essential, curl, Rust.

If an error about a `.pc` file appears, add the directory to the environment variable:
```bash
export PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig
```

After installing dependencies on your platform, run:
```bash
pnpm tauri dev
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
