# Tauri Auto-Updater Configuration Guide

This document explains how the auto-updater system works in Pixsaur and how to configure it for releases.

## Overview

Pixsaur uses Tauri's built-in updater plugin to provide automatic updates for desktop users. Updates are:
- ✅ **Signed cryptographically** for security
- ✅ **Verified before installation** using public key cryptography
- ✅ **Downloaded from GitHub Releases** automatically
- ✅ **Applied with one click** and automatic app restart

## Architecture

### Components

1. **Frontend Component**: `src/components/updater/updater.tsx`
   - Checks for updates on app start
   - Displays notification when update available
   - Handles download, installation, and restart

2. **Rust Plugins**: `src-tauri/src/lib.rs`
   - `tauri-plugin-updater`: Manages update checks and downloads
   - `tauri-plugin-process`: Handles app restart after update

3. **Configuration**: `src-tauri/tauri.conf.json`
   - Update endpoint URL
   - Public key for signature verification
   - Permissions for updater and process plugins

4. **Build Pipeline**: `.github/workflows/release.yml`
   - Signs builds with private key
   - Uploads artifacts for all platforms
   - Creates release with signatures

## Security: Signing Keys

### Key Generation

Keys were generated using Tauri's signer tool:

```bash
pnpm tauri signer generate -w ~/.tauri/pixsaur.key
```

This creates two files:
- **Private key**: `~/.tauri/pixsaur.key` (🔒 **KEEP SECRET!**)
- **Public key**: `~/.tauri/pixsaur.key.pub` (✅ Safe to commit)

### Key Storage

**Private Key** (🔒 Secret):
- Stored in GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`
- Password stored as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Used by GitHub Actions to sign releases
- **NEVER commit the private key to git**

**Public Key** (✅ Public):
- Embedded in `src-tauri/tauri.conf.json`
- Bundled with the app
- Used to verify update signatures

## GitHub Secrets Configuration

### Required Secrets

Add these secrets at: https://github.com/IIIvan37/pixsaur/settings/secrets/actions

#### 1. `TAURI_SIGNING_PRIVATE_KEY`
```
# Content of ~/.tauri/pixsaur.key
untrusted comment: <key comment>
<base64-encoded-private-key>
```

To display your private key:
```bash
cat ~/.tauri/pixsaur.key
```

⚠️ **Copy the ENTIRE file content, including the comment line**

#### 2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
```
<the-password-you-entered-during-key-generation>
```

### Adding Secrets

1. Go to repository settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `TAURI_SIGNING_PRIVATE_KEY` with the private key content
4. Click "New repository secret" again
5. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` with your password

## Release Process

### 1. Prepare Release

```bash
# Ensure all changes are committed
git add -A
git commit -m "feat: prepare v0.1.0 release"

# Update version in src-tauri/tauri.conf.json
# "version": "0.1.0"

# Commit version bump
git add src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.1.0"
```

### 2. Create Git Tag

```bash
# Create annotated tag
git tag -a v0.1.0 -m "Release v0.1.0"

# Push commits and tag
git push origin feature/tauri-desktop
git push origin v0.1.0
```

### 3. GitHub Actions Build

The workflow `.github/workflows/release.yml` will:
1. ✅ Build for Linux (Ubuntu 22.04)
2. ✅ Build for Windows (latest)
3. ✅ Build for macOS (latest)
4. ✅ Sign all builds with private key
5. ✅ Upload artifacts:
   - Linux: `.AppImage`, `.deb`, `.sig` files
   - Windows: `.msi`, `.exe`, `.sig` files
   - macOS: `.dmg`, `.app`, `.sig` files

### 4. Create GitHub Release

1. Go to https://github.com/IIIvan37/pixsaur/releases
2. Click "Draft a new release"
3. Choose the tag (e.g., `v0.1.0`)
4. Add release notes
5. Download the build artifacts from the workflow run
6. Attach ALL files to the release (including `.sig` signature files)
7. Tauri will automatically generate `latest.json` manifest

### 5. Publish Release

Click "Publish release" - users will now receive update notifications!

## Update Manifest (latest.json)

Tauri automatically generates this file with information about available updates:

```json
{
  "version": "0.1.0",
  "notes": "Release notes",
  "pub_date": "2025-10-26T00:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "base64-signature",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.0/pixsaur.AppImage"
    },
    "windows-x86_64": {
      "signature": "base64-signature",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.0/pixsaur.msi"
    },
    "darwin-x86_64": {
      "signature": "base64-signature",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.0/pixsaur.dmg"
    }
  }
}
```

## User Experience

### Update Flow

1. **App Launch**: Updater checks GitHub for `latest.json`
2. **New Version Found**: Green notification appears in top-right corner
3. **User Clicks "Update Now"**: Download starts in background
4. **Download Complete**: Signature verified using public key
5. **Installation**: Update applied silently
6. **Restart**: App automatically restarts with new version

### UI Component

Located in `src/components/updater/updater.tsx`:

```tsx
<Updater />  // Shown only in Tauri mode (not web browser)
```

Features:
- ✅ Auto-check on app start
- ✅ Non-intrusive notification
- ✅ One-click update
- ✅ Progress indication
- ✅ Automatic restart

## Configuration Files

### tauri.conf.json
```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/IIIvan37/pixsaur/releases/latest/download/latest.json"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVBM0VBRkU2RkU5NDI3NzUKUldSMUo1VCs1cTgrNmhlM2Fkc3BhU1FDN0ZxMHdyYjB6TG9VbnNxb1RnSnVDMjJLQndkRWk1TT0K"
    }
  }
}
```

### Cargo.toml
```toml
[dependencies]
tauri-plugin-updater = "2.9.0"
tauri-plugin-process = "2.3.0"
```

### package.json
```json
{
  "dependencies": {
    "@tauri-apps/plugin-updater": "2.9.0",
    "@tauri-apps/plugin-process": "2.3.0"
  }
}
```

## Permissions

Required in `tauri.conf.json`:

```json
{
  "permissions": [
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install",
    "process:default",
    "process:allow-restart"
  ]
}
```

## Troubleshooting

### Update Check Fails

**Symptoms**: No update notification appears

**Possible causes**:
- ❌ No internet connection
- ❌ GitHub rate limiting
- ❌ `latest.json` not found in release
- ❌ Release not published

**Solution**: Check browser console for error messages

### Signature Verification Fails

**Symptoms**: "Update failed" error after download

**Possible causes**:
- ❌ Wrong public key in `tauri.conf.json`
- ❌ `.sig` files missing from release
- ❌ Files corrupted during upload

**Solution**: Re-upload release with correct signatures

### Private Key Lost

**Symptoms**: Cannot sign new releases

**Solution**:
1. ⚠️ **CRITICAL**: You CANNOT update existing users
2. Generate new keypair: `pnpm tauri signer generate -w ~/.tauri/pixsaur-new.key`
3. Update public key in `tauri.conf.json`
4. Update GitHub secrets
5. Users on old key will NOT receive updates (they must reinstall)

**Prevention**: Backup `~/.tauri/pixsaur.key` securely (encrypted)

## Security Best Practices

### ✅ DO:
- Keep private key encrypted and backed up
- Use strong password for private key
- Rotate keys periodically (with migration plan)
- Verify signatures before publishing releases
- Use HTTPS for update endpoints

### ❌ DON'T:
- Commit private key to git
- Share private key via chat/email
- Store private key unencrypted
- Use weak passwords
- Publish unsigned releases

## Testing Updates

### Local Testing

```bash
# 1. Build with signing
TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/pixsaur.key) \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your-password> \
pnpm tauri build

# 2. Create fake release
# - Upload to GitHub as draft release
# - Test update flow
# - Delete draft when done
```

### Production Testing

1. Create release candidate tag: `v0.1.0-rc.1`
2. Build and publish as pre-release
3. Test update on clean install
4. If successful, publish final `v0.1.0`

## Distribution Formats

### Linux
- **AppImage**: Portable, no installation, recommended
- **deb**: For Debian/Ubuntu, system integration

### Windows
- **msi**: Official Windows Installer, enterprise-friendly
- **exe** (NSIS): Flexible installer, custom screens

### macOS
- **dmg**: Disk image for distribution
- **app**: Application bundle

All formats support auto-update!

## References

- [Tauri Updater Documentation](https://v2.tauri.app/plugin/updater/)
- [Tauri Signer Guide](https://v2.tauri.app/reference/cli/#signer)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## Maintenance

### Updating Dependencies

```bash
# Update Tauri plugins
pnpm update @tauri-apps/plugin-updater @tauri-apps/plugin-process

# Update Rust dependencies
cd src-tauri
cargo update tauri-plugin-updater tauri-plugin-process
```

### Monitoring

Check update metrics:
1. GitHub Releases download counts
2. Browser console logs (for errors)
3. User reports of update issues

---

**Last Updated**: October 26, 2025  
**Tauri Version**: 2.9.1  
**Plugin Versions**: updater@2.9.0, process@2.3.0
