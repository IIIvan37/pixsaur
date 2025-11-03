# Commit Message

## feat: Add Netlify Functions infrastructure for advanced CPC exports

### Summary

Set up serverless backend infrastructure using Netlify Functions to enable advanced export capabilities for Amstrad CPC development, including DSK disk image creation, SNA snapshot generation, and Z80 assembly with RASM.

### What's New

- **Netlify Functions API** with 4 endpoints (health, assemble, create-dsk, create-sna)
- **Type-safe API client** for frontend integration
- **Advanced Export UI component** for user interface
- **Comprehensive documentation** covering architecture, roadmap, and integration guides

### Technical Details

#### Backend (Netlify Functions)

- `netlify.toml`: Netlify configuration with functions setup
- `netlify/functions/health.ts`: API health check endpoint
- `netlify/functions/assemble.ts`: Z80 assembly endpoint (RASM integration planned)
- `netlify/functions/create-dsk.ts`: DSK disk image creation endpoint (implementation planned)
- `netlify/functions/create-sna.ts`: SNA snapshot creation endpoint (implementation planned)
- `netlify/types.ts`: Shared TypeScript types for API contracts

#### Frontend

- `src/libs/api-client.ts`: Type-safe API client with helpers
- `src/components/advanced-export/`: React component for advanced exports
- Integration points for future DSK/SNA export features

#### Documentation

- `ARCHITECTURE.md`: Complete system architecture and data flow
- `ROADMAP.md`: 7-phase development plan with timeline
- `QUICKSTART.md`: Quick start guide for developers
- `NETLIFY_SETUP.md`: Infrastructure setup summary
- `netlify/README.md`: API documentation and endpoint reference
- `netlify/RASM_INTEGRATION.md`: RASM integration guide with 3 approaches
- `netlify/EXAMPLES.md`: 6 practical usage examples

#### Tooling

- `netlify/test-functions.sh`: Automated testing script for all endpoints
- `netlify/.gitignore`: Ignore rules for RASM binaries and artifacts

### Dependencies

- Added `@netlify/functions` (v5.0.1) for TypeScript types

### Status

✅ Infrastructure complete and ready
🚧 RASM integration pending (Phase 2)
🚧 DSK/SNA implementation pending (Phases 3-4)

### Next Steps

1. Compile RASM to WebAssembly
2. Implement DSK format writer (DATA + EXTENDED)
3. Implement SNA v3 format writer
4. Connect UI to Pixsaur state
5. Add internationalization

### Testing

- ✅ TypeScript compilation passes
- ✅ Biome linting passes (267 files checked)
- ✅ All functions have proper error handling
- ✅ API client fully type-safe

### Breaking Changes

None - This is additive functionality only

### References

- RASM: https://github.com/EdouardBERGE/rasm
- DSK Format: http://www.cpcwiki.eu/index.php/Format:DSK_disk_image_file_format
- SNA Format: http://www.cpcwiki.eu/index.php/Format:SNA_snapshot_file_format
- Netlify Functions: https://docs.netlify.com/functions/overview/

---

**Files Added:** 18
**Lines Added:** ~2,000+
**Documentation Pages:** 8
