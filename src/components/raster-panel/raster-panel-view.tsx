import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useId, useState } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Icon from '@/components/ui/icon'
import PixsaurPopover from '@/components/ui/popover'
import {
  SimpleColorGrid,
  SimpleRgbPicker
} from '@/components/ui/simple-color-picker'
import PixsaurSlider from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch/switch'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import { vectorToHex } from '@/palettes/cpc-palette'
import styles from './raster-panel.module.css'

export interface RasterPanelViewProps {
  readonly disabled?: boolean
  readonly enabled: boolean
  readonly onEnabledChange: (enabled: boolean) => void
  readonly ranges: RasterRange[]
  readonly conflicts: string[]
  readonly maxLine: number
  readonly palette: Vector[]
  readonly nColors: number
  readonly cpcPalette: CPCColor[]
  readonly isClassicMode: boolean
  readonly onAddRange: () => void
  readonly onUpdateRange: (
    id: string,
    field: keyof Omit<RasterRange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  readonly onRemoveRange: (id: string) => void
}

/**
 * Calculate allowed bounds for a range to prevent overlap with other ranges
 * Returns { minStart, maxEnd } - the allowed limits for this range
 */
function calculateAllowedBounds(
  currentRange: RasterRange,
  allRanges: RasterRange[],
  maxLine: number
): { minStart: number; maxEnd: number } {
  // Get other ranges sorted by startLine
  const otherRanges = allRanges
    .filter((r) => r.id !== currentRange.id)
    .sort((a, b) => a.startLine - b.startLine)

  let minStart = 0
  let maxEnd = maxLine

  for (const other of otherRanges) {
    // If this range is before current range's start
    if (other.endLine < currentRange.startLine) {
      // The minStart must be after this range ends
      minStart = Math.max(minStart, other.endLine + 1)
    }
    // If this range is after current range's end
    else if (other.startLine > currentRange.endLine) {
      // The maxEnd must be before this range starts
      maxEnd = Math.min(maxEnd, other.startLine - 1)
      break // Since sorted, no need to check further
    }
  }

  return { minStart, maxEnd }
}

/**
 * Compact ink selector - small colored squares
 */
function InkSelector({
  palette,
  nColors,
  selectedInk,
  onSelectInk
}: {
  palette: Vector[]
  nColors: number
  selectedInk: number
  onSelectInk: (ink: number) => void
}) {
  const { _ } = useLingui()
  const inkIndices = Array.from({ length: nColors }, (_, i) => i)

  return (
    <div className={styles.inkSelector}>
      {inkIndices.map((inkIndex) => {
        const color = palette[inkIndex] || [0, 0, 0]
        const isSelected = inkIndex === selectedInk
        return (
          <button
            key={`ink-slot-${inkIndex}`}
            type='button'
            className={`${styles.inkButton} ${isSelected ? styles.inkSelected : ''}`}
            style={{
              backgroundColor: `#${vectorToHex(color as Vector<'RGB'>)}`
            }}
            onClick={() => onSelectInk(inkIndex)}
            title={_(msg`Encre ${inkIndex}`)}
          >
            <span className={styles.inkNumber}>{inkIndex}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Color trigger button with popover
 */
function ColorTrigger({
  color,
  cpcPalette,
  isClassicMode,
  onColorChange
}: {
  color: Vector<'RGB'>
  cpcPalette: CPCColor[]
  isClassicMode: boolean
  onColorChange: (color: Vector<'RGB'>) => void
}) {
  const { _ } = useLingui()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <PixsaurPopover
      open={isOpen}
      onOpenChange={setIsOpen}
      variant='default'
      trigger={
        <button
          type='button'
          className={styles.colorTriggerButton}
          title={_(msg`Sélectionner une couleur`)}
        >
          <span
            className={styles.colorSwatch}
            style={{ backgroundColor: `#${vectorToHex(color)}` }}
          />
        </button>
      }
    >
      {isClassicMode ? (
        <SimpleColorGrid
          palette={cpcPalette}
          onColorSelect={(c) => {
            onColorChange(c.vector as Vector<'RGB'>)
            setIsOpen(false)
          }}
        />
      ) : (
        <SimpleRgbPicker
          initialColor={color}
          onColorConfirm={(c) => {
            onColorChange(c as Vector<'RGB'>)
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </PixsaurPopover>
  )
}

/**
 * Compact range row - all controls on one line
 */
function RangeRow({
  range,
  index,
  hasConflict,
  minStart,
  maxEnd,
  palette,
  nColors,
  cpcPalette,
  isClassicMode,
  adjacentPreviousRange,
  onUpdate,
  onRemove
}: {
  range: RasterRange
  index: number
  hasConflict: boolean
  minStart: number
  maxEnd: number
  palette: Vector[]
  nColors: number
  cpcPalette: CPCColor[]
  isClassicMode: boolean
  adjacentPreviousRange: RasterRange | null
  onUpdate: (
    field: keyof Omit<RasterRange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  onRemove: () => void
}) {
  const { _ } = useLingui()
  return (
    <div className={`${styles.rangeRow} ${hasConflict ? styles.conflict : ''}`}>
      {/* Range number */}
      <span className={styles.rangeNumber}>{index + 1}</span>

      {/* Start line slider */}
      <div className={styles.sliderGroup}>
        <span className={styles.sliderValue}>{range.startLine}</span>
        <PixsaurSlider
          min={minStart}
          max={range.endLine}
          value={range.startLine}
          onChange={(val) => onUpdate('startLine', val)}
          hideLabel
          showTooltip={false}
        />
      </div>

      <span className={styles.sliderSeparator}>→</span>

      {/* End line slider */}
      <div className={styles.sliderGroup}>
        <PixsaurSlider
          min={range.startLine}
          max={maxEnd}
          value={range.endLine}
          onChange={(val) => onUpdate('endLine', val)}
          hideLabel
          showTooltip={false}
        />
        <span className={styles.sliderValue}>{range.endLine}</span>
      </div>

      {/* Ink selector */}
      <div className={styles.inkGroup}>
        <InkSelector
          palette={palette}
          nColors={nColors}
          selectedInk={range.inkIndex}
          onSelectInk={(ink) => {
            onUpdate('inkIndex', ink)
            // If adjacent to previous range and selecting the same ink, inherit its color
            const shouldInheritColor =
              adjacentPreviousRange && adjacentPreviousRange.inkIndex === ink
            const inkColor = shouldInheritColor
              ? adjacentPreviousRange.color
              : palette[ink] || [0, 0, 0]
            onUpdate('color', inkColor as Vector<'RGB'>)
          }}
        />
      </div>

      {/* Color picker */}
      <ColorTrigger
        color={range.color}
        cpcPalette={cpcPalette}
        isClassicMode={isClassicMode}
        onColorChange={(c) => onUpdate('color', c)}
      />

      {/* Delete button */}
      <button
        type='button'
        className={styles.deleteButton}
        onClick={onRemove}
        title={_(msg`Supprimer la plage`)}
      >
        <Icon name='TrashIcon' />
      </button>

      {/* Conflict indicator */}
      <span className={styles.conflictIcon}>
        {hasConflict && <Icon name='ExclamationTriangleIcon' />}
      </span>
    </div>
  )
}

export function RasterPanelView({
  disabled = false,
  enabled,
  onEnabledChange,
  ranges,
  conflicts,
  maxLine,
  palette,
  nColors,
  cpcPalette,
  isClassicMode,
  onAddRange,
  onUpdateRange,
  onRemoveRange
}: RasterPanelViewProps) {
  const switchId = useId()

  return (
    <CollapsibleSection
      title={<Trans>Effets Raster</Trans>}
      defaultOpen={false}
    >
      <div className={styles.container}>
        <div className={styles.toggleRow}>
          <Switch
            id={switchId}
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
          />
          <span className={styles.toggleLabel}>
            <Trans>Activer l'aperçu raster</Trans>
          </span>
        </div>

        {enabled && (
          <>
            {ranges.length > 0 && (
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>#</span>
                <span className={styles.headerLabel}>
                  <Trans>Début</Trans>
                </span>
                <span />
                <span className={styles.headerLabel}>
                  <Trans>Fin</Trans>
                </span>
                <span className={styles.headerLabel}>
                  <Trans>Encre</Trans>
                </span>
                <span className={styles.headerLabel}>
                  <Trans>Couleur</Trans>
                </span>
                <span />
              </div>
            )}

            {ranges.length === 0 ? (
              <div className={styles.emptyState}>
                <Trans>Aucune plage raster définie.</Trans>
              </div>
            ) : (
              <div className={styles.rangesList}>
                {[...ranges]
                  .sort((a, b) => a.startLine - b.startLine)
                  .map((range, index, sortedRanges) => {
                    const { minStart, maxEnd } = calculateAllowedBounds(
                      range,
                      ranges,
                      maxLine
                    )
                    // Find adjacent previous range (its endLine + 1 = this range's startLine)
                    const adjacentPreviousRange =
                      sortedRanges.find(
                        (r) => r.endLine + 1 === range.startLine
                      ) || null
                    return (
                      <RangeRow
                        key={range.id}
                        range={range}
                        index={index}
                        hasConflict={conflicts.includes(range.id)}
                        minStart={minStart}
                        maxEnd={maxEnd}
                        palette={palette}
                        nColors={nColors}
                        cpcPalette={cpcPalette}
                        isClassicMode={isClassicMode}
                        adjacentPreviousRange={adjacentPreviousRange}
                        onUpdate={(field, value) =>
                          onUpdateRange(range.id, field, value)
                        }
                        onRemove={() => onRemoveRange(range.id)}
                      />
                    )
                  })}
              </div>
            )}

            <button
              type='button'
              className={styles.addButton}
              onClick={onAddRange}
            >
              <Icon name='PlusIcon' />
              <Trans>Ajouter une plage</Trans>
            </button>
          </>
        )}
      </div>
    </CollapsibleSection>
  )
}
