# Pixsaur

**Image converter for Amstrad CPC** - Web and desktop application with palette quantization, dithering, and multi-format exports.

## Features

- **CPC palette quantization** : 27 colors (Classic) or 4096 colors (Plus)
- **Color spaces** : RGB, Lab, XYZ for maximum precision
- **Dithering and adjustments** : Brightness, contrast, saturation in real-time
- **Export** : scr, linear, palette, png...
- **CPU/GPU architecture** : Adaptive processing with intelligent fallback

## Download

### Pre-built binaries

Download the latest desktop application for your platform:

- **Windows** : [pixsaur_x.x.x_x64-setup.exe](https://github.com/IIIvan37/pixsaur/releases/latest)
- **macOS** : [pixsaur_x.x.x_x64.dmg](https://github.com/IIIvan37/pixsaur/releases/latest)
- **Linux** : [pixsaur_x.x.x_amd64.AppImage](https://github.com/IIIvan37/pixsaur/releases/latest)

### Web version

Try the web version online: [https://iiivan37.github.io/pixsaur](https://iiivan37.github.io/pixsaur)

## Development

### Setup

```bash
pnpm install
pnpm dev          # Web (http://localhost:5173)
pnpm tauri:dev    # Desktop
```

### Build

```bash
pnpm build              # Web build (dist/)
pnpm tauri:build        # Desktop build (src-tauri/target/release/)
```

## Tech Stack

- **React 19** + TypeScript + Vite
- **Jotai** - Atomic state management
- **Tauri 2.9** - Cross-platform desktop
- **pixsaur-color** - Custom colorimetric library (Lab, XYZ, RGB)
- **Biome** - Linting and formatting

## Contribution

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details
