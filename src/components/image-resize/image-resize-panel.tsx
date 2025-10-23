/**
 * Image Resize Panel Component
 * Provides controls for resizing the selection with CPC constraints
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  resizeModeAtom,
  setResizeModeAtom,
  targetWidthAtom,
  targetHeightAtom,
  setTargetWidthAtom,
  setTargetHeightAtom,
  resizeValidationAtom,
  modeAtom
} from '@/app/store/config/config'
import { selectionAtom } from '@/app/store/image/image'
import type { ResizeMode, CPCMode } from '@/app/store/config/resize-types'
import { CPC_PRESETS } from '@/app/store/config/resize-types'
import styles from './image-resize-panel.module.css'

export function ImageResizePanel() {
  const resizeMode = useAtomValue(resizeModeAtom)
  const [targetWidth, setTargetWidth] = useAtom(targetWidthAtom)
  const [targetHeight, setTargetHeight] = useAtom(targetHeightAtom)
  const validation = useAtomValue(resizeValidationAtom)
  const cpcMode = useAtomValue(modeAtom)
  const selection = useAtomValue(selectionAtom)
  const setResizeModeAction = useSetAtom(setResizeModeAtom)
  const setWidthAction = useSetAtom(setTargetWidthAtom)
  const setHeightAction = useSetAtom(setTargetHeightAtom)

  const numericMode = Number.parseInt(cpcMode, 10) as CPCMode
  const presets = CPC_PRESETS[`mode${numericMode}` as keyof typeof CPC_PRESETS]

  const handleModeChange = (mode: ResizeMode) => {
    setResizeModeAction(mode)
  }

  const handleWidthChange = (value: number) => {
    setWidthAction(value)
  }

  const handleHeightChange = (value: number) => {
    setHeightAction(value)
  }

  const handlePresetSelect = (width: number, height: number) => {
    setTargetWidth(width)
    setTargetHeight(height)
  }

  // Memory indicator color
  const getMemoryStatusClass = () => {
    if (!validation.memory.valid) return styles.memoryDanger
    if (validation.memory.kb > 16) return styles.memoryWarning
    return styles.memoryOk
  }

  const getWidthClass = () => (validation.width.valid ? '' : styles.inputError)
  const getHeightClass = () => (validation.height.valid ? '' : styles.inputError)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Resize Mode</h3>
      </div>

      {/* Source dimensions info */}
      {selection && (
        <div className={styles.section}>
          <div className={styles.infoBox}>
            <div className={styles.label}>Source (Selection):</div>
            <div className={styles.dimensionInfo}>
              {selection.width} × {selection.height} pixels
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      <div className={styles.section}>
        <div className={styles.label}>Mode:</div>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="resizeMode"
              value="auto"
              checked={resizeMode === 'auto'}
              onChange={() => handleModeChange('auto')}
            />
            <span>Auto (Smart CPC adapt)</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="resizeMode"
              value="keepSmaller"
              checked={resizeMode === 'keepSmaller'}
              onChange={() => handleModeChange('keepSmaller')}
            />
            <span>Keep Smaller (Letterbox)</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="resizeMode"
              value="keepLarger"
              checked={resizeMode === 'keepLarger'}
              onChange={() => handleModeChange('keepLarger')}
            />
            <span>Keep Larger (Crop)</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="resizeMode"
              value="origin"
              checked={resizeMode === 'origin'}
              onChange={() => handleModeChange('origin')}
            />
            <span>Origin (No Scale)</span>
          </label>
        </div>
      </div>

      {/* Show target dimensions controls only for non-auto modes */}
      {resizeMode !== 'auto' && (
        <>
          <div className={styles.section}>
            <div className={styles.label}>Presets:</div>
            <div className={styles.presetButtons}>
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={styles.presetButton}
                  onClick={() => handlePresetSelect(preset.width, preset.height)}
                >
                  {preset.name} ({preset.width}×{preset.height})
                </button>
              ))}
            </div>
          </div>

          {/* Target Dimensions */}
          <div className={styles.section}>
            <div className={styles.label}>Target Size:</div>
            <div className={styles.dimensionsRow}>
              <div className={styles.dimensionInput}>
                <label htmlFor="resize-target-width">Width:</label>
                <input
                  id="resize-target-width"
                  type="number"
                  min="8"
                  max="800"
                  value={targetWidth}
                  onChange={(e) => handleWidthChange(Number.parseInt(e.target.value, 10))}
                  className={getWidthClass()}
                />
                {!validation.width.valid && (
                  <span className={styles.errorMessage}>{validation.width.message}</span>
                )}
              </div>
              <div className={styles.dimensionInput}>
                <label htmlFor="resize-target-height">Height:</label>
                <input
                  id="resize-target-height"
                  type="number"
                  min="2"
                  max="300"
                  value={targetHeight}
                  onChange={(e) => handleHeightChange(Number.parseInt(e.target.value, 10))}
                  className={getHeightClass()}
                />
                {!validation.height.valid && (
                  <span className={styles.errorMessage}>{validation.height.message}</span>
                )}
              </div>
            </div>
          </div>

          {/* Memory Validation */}
          <div className={styles.section}>
            <div className={`${styles.memoryIndicator} ${getMemoryStatusClass()}`}>
              <div className={styles.memoryLabel}>Memory:</div>
              <div className={styles.memoryValue}>
                {validation.memory.bytes} bytes ({validation.memory.kb.toFixed(2)} Ko)
              </div>
              {validation.memory.message && (
                <div className={styles.memoryMessage}>{validation.memory.message}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
