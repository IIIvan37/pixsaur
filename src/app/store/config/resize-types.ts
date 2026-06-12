/**
 * Shim de ré-exports — les types resize canoniques vivent dans
 * @/domain/image-processing (voir docs/refactor/ADR-001-file-layout.md).
 * L'organisation du store est gelée pendant le refactor clean-archi.
 */

export {
  type CPCMode,
  getNormalizedTargetSize,
  type ResizeConfig,
  type ResizeMode
} from '@/domain/image-processing'
