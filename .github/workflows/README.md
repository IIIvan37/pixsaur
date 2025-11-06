# GitHub Workflows

## build-rasm-wasm.yml

Builds RASM WebAssembly binaries and commits them to the repository.

### Triggers

- **Manual**: Via GitHub Actions UI (workflow_dispatch)
- **Automatic**:
  - On push to `main` branch when:
    - `scripts/build-rasm-wasm.sh` is modified
    - This workflow file is modified

### Process

1. Uses official Emscripten Docker image (`emscripten/emsdk:latest`)
2. Runs `scripts/build-rasm-wasm.sh`
3. Commits generated files to `public/wasm/`:
   - `rasm.js`
   - `rasm.wasm`
   - `RASM-LICENSE.txt`
4. Uploads artifacts for download

### Why commit WASM files?

Netlify doesn't have Emscripten installed, so we pre-build the WASM files via GitHub Actions and commit them to the repository. This ensures they're available during Netlify deployment.

### Manual trigger

Go to Actions → Build RASM WebAssembly → Run workflow

### Local build

If you need to build locally:

```bash
# Requires Emscripten SDK installed
./scripts/build-rasm-wasm.sh
```

Then commit the generated files manually.
