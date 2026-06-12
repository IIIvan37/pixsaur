import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useMemo, useState } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Icon from '@/components/ui/icon'
import PixsaurPopover from '@/components/ui/popover'
import {
  SimpleColorGrid,
  SimpleRgbPicker
} from '@/components/ui/simple-color-picker'
import PixsaurSlider from '@/components/ui/slider'
import { vectorToHex } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import styles from './raster-panel.module.css'

export interface RasterPanelViewProps {
  readonly enabled: boolean
  readonly changes: RasterChange[]
  readonly conflicts: string[]
  readonly maxLine: number
  readonly palette: Vector[]
  readonly nColors: number
  readonly maxChangesPerLine: number
  readonly cpcPalette: CPCColor[]
  readonly isClassicMode: boolean
  /** CPC Plus hardware mode */
  readonly isPlusMode: boolean
  readonly onAddChange: () => void
  readonly onUpdateChange: (
    id: string,
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  readonly onRemoveChange: (id: string) => void
  /** Clear all raster changes */
  readonly onClearAll?: () => void
}

/** Group changes by line number */
interface LineGroup {
  line: number
  changes: RasterChange[]
}

function groupChangesByLine(changes: RasterChange[]): LineGroup[] {
  const groups = new Map<number, RasterChange[]>()

  for (const change of changes) {
    const existing = groups.get(change.line) || []
    existing.push(change)
    groups.set(change.line, existing)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([line, lineChanges]) => ({
      line,
      changes: [...lineChanges].sort((a, b) => a.inkIndex - b.inkIndex)
    }))
}

/**
 * Ink selector - small colored squares to pick ink number
 */
export function InkSelector({
  nColors,
  selectedInk,
  onSelectInk,
  allowedInks
}: {
  readonly nColors: number
  readonly selectedInk: number
  readonly onSelectInk: (ink: number) => void
  readonly allowedInks?: number[]
}) {
  const inkIndices = allowedInks ?? Array.from({ length: nColors }, (_, i) => i)

  return (
    <div className={styles.inkSelectorGrid}>
      {inkIndices.map((inkIndex) => {
        const isSelected = inkIndex === selectedInk
        return (
          <button
            key={`ink-${inkIndex}`}
            type='button'
            className={`${styles.inkSelectorButton} ${isSelected ? styles.inkSelectorSelected : ''}`}
            onClick={() => onSelectInk(inkIndex)}
          >
            {inkIndex}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Ink and color trigger button with popover
 */
export function InkColorTrigger({
  color,
  inkIndex,
  nColors,
  cpcPalette,
  isClassicMode,
  onInkChange,
  onColorChange,
  allowedInks
}: {
  readonly color: Vector<'RGB'>
  readonly inkIndex: number
  readonly nColors: number
  readonly cpcPalette: CPCColor[]
  readonly isClassicMode: boolean
  readonly onInkChange: (ink: number) => void
  readonly onColorChange: (color: Vector<'RGB'>) => void
  readonly allowedInks?: number[]
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
          className={styles.inkColorButton}
          title={_(msg`Encre ${inkIndex}`)}
        >
          <span className={styles.inkLabel}>{inkIndex}</span>
          <span className={styles.arrow}>→</span>
          <span
            className={styles.colorSwatch}
            style={{ backgroundColor: `#${vectorToHex(color)}` }}
          />
        </button>
      }
    >
      <div className={styles.inkColorPopover}>
        <div className={styles.popoverSection}>
          <span className={styles.popoverLabel}>
            <Trans>Encre</Trans>
          </span>
          <InkSelector
            nColors={nColors}
            selectedInk={inkIndex}
            onSelectInk={(ink) => {
              onInkChange(ink)
            }}
            allowedInks={allowedInks}
          />
        </div>
        <div className={styles.popoverSection}>
          <span className={styles.popoverLabel}>
            <Trans>Couleur</Trans>
          </span>
          {isClassicMode ? (
            <SimpleColorGrid
              palette={cpcPalette}
              onColorSelect={(c) => {
                onColorChange(c.vector)
                setIsOpen(false)
              }}
            />
          ) : (
            <SimpleRgbPicker
              initialColor={color}
              onColorConfirm={(c) => {
                onColorChange(c)
              }}
              onClose={() => setIsOpen(false)}
            />
          )}
        </div>
      </div>
    </PixsaurPopover>
  )
}

/**
 * Compact line row - shows all ink changes for one line
 */
function LineRow({
  group,
  conflicts,
  nColors,
  maxLine,
  maxChangesPerLine,
  cpcPalette,
  isClassicMode,
  onUpdateChange,
  onRemoveChange
}: {
  readonly group: LineGroup
  readonly conflicts: string[]
  readonly nColors: number
  readonly maxLine: number
  readonly maxChangesPerLine: number
  readonly cpcPalette: CPCColor[]
  readonly isClassicMode: boolean
  readonly onUpdateChange: (
    id: string,
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  readonly onRemoveChange: (id: string) => void
}) {
  const { _ } = useLingui()
  const hasConflict = group.changes.some((c) => conflicts.includes(c.id))
  const [isLinePopoverOpen, setIsLinePopoverOpen] = useState(false)

  // Calculate which inks are allowed for each change on this line
  // An ink is allowed if: it's already used by this change, OR adding it wouldn't exceed maxChangesPerLine
  const usedInksOnLine = new Set(group.changes.map((c) => c.inkIndex))
  const canAddMoreInks = usedInksOnLine.size < maxChangesPerLine

  // Handle line number change for all changes in this group
  const handleLineChange = (newLine: number) => {
    const clampedLine = Math.max(0, Math.min(maxLine, newLine))
    for (const change of group.changes) {
      onUpdateChange(change.id, 'line', clampedLine)
    }
  }

  return (
    <div className={`${styles.lineRow} ${hasConflict ? styles.conflict : ''}`}>
      <PixsaurPopover
        open={isLinePopoverOpen}
        onOpenChange={setIsLinePopoverOpen}
        variant='default'
        trigger={
          <button
            type='button'
            className={styles.lineButton}
            title={_(msg`Ligne ${group.line}`)}
          >
            {group.line}
          </button>
        }
      >
        <div className={styles.linePopover}>
          <PixsaurSlider
            label={<Trans>Ligne</Trans>}
            min={0}
            max={maxLine}
            value={group.line}
            onChange={handleLineChange}
          />
        </div>
      </PixsaurPopover>
      <div className={styles.inkChanges}>
        {group.changes.map((change) => {
          // For this specific change, allowed inks are:
          // - Inks already used on this line
          // - If we can add more, also show unused inks up to nColors
          let allowedInks: number[]
          if (canAddMoreInks) {
            // Can select any ink from 0 to nColors-1
            allowedInks = Array.from({ length: nColors }, (_, i) => i)
          } else {
            // Can only select inks already used on this line (including current)
            allowedInks = Array.from(usedInksOnLine)
          }

          return (
            <div key={change.id} className={styles.inkChange}>
              <InkColorTrigger
                color={change.color}
                inkIndex={change.inkIndex}
                nColors={nColors}
                cpcPalette={cpcPalette}
                isClassicMode={isClassicMode}
                onInkChange={(ink) =>
                  onUpdateChange(change.id, 'inkIndex', ink)
                }
                onColorChange={(c) => onUpdateChange(change.id, 'color', c)}
                allowedInks={allowedInks}
              />
              <button
                type='button'
                className={styles.removeInkButton}
                onClick={() => onRemoveChange(change.id)}
                title={_(msg`Supprimer le changement`)}
              >
                <Icon name='Cross2Icon' />
              </button>
            </div>
          )
        })}
      </div>
      {hasConflict && (
        <span className={styles.conflictIcon}>
          <Icon name='ExclamationTriangleIcon' />
        </span>
      )}
    </div>
  )
}

export function RasterPanelView({
  enabled,
  changes,
  conflicts,
  maxLine,
  palette,
  nColors,
  maxChangesPerLine,
  cpcPalette,
  isClassicMode,
  isPlusMode,
  onAddChange,
  onUpdateChange,
  onRemoveChange,
  onClearAll
}: Readonly<RasterPanelViewProps>) {
  const lineGroups = useMemo(() => groupChangesByLine(changes), [changes])

  // Count unique colors: palette colors + raster colors
  const uniqueColorsCount = useMemo(() => {
    const colorSet = new Set<string>()
    // Add palette colors
    for (const color of palette) {
      colorSet.add(color.join(','))
    }
    // Add raster change colors
    for (const change of changes) {
      colorSet.add(change.color.join(','))
    }
    return colorSet.size
  }, [palette, changes])

  const title = (
    <>
      <Trans>Effets Raster</Trans>
      {changes.length > 0 && (
        <span className={styles.uniqueColorsCount}>
          <Trans>{uniqueColorsCount} couleur(s) unique(s)</Trans>
        </span>
      )}
    </>
  )

  return (
    <div className={styles.section}>
      <CollapsibleSection
        title={title}
        defaultOpen={false}
        disabled={!enabled}
        open={enabled ? undefined : false}
      >
        <div className={styles.container}>
          <div className={styles.modeInfo}>
            <span className={styles.modeBadge}>
              {isPlusMode ? 'CPC Plus' : 'CPC Classic'}
            </span>
            <span className={styles.modeHint}>
              <Trans>Max {maxChangesPerLine} changement(s) par ligne</Trans>
            </span>
          </div>

          {lineGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <Trans>Aucun changement raster défini.</Trans>
            </div>
          ) : (
            <div className={styles.linesList}>
              {lineGroups.map((group) => (
                <LineRow
                  key={group.line}
                  group={group}
                  conflicts={conflicts}
                  nColors={nColors}
                  maxLine={maxLine}
                  maxChangesPerLine={maxChangesPerLine}
                  cpcPalette={cpcPalette}
                  isClassicMode={isClassicMode}
                  onUpdateChange={onUpdateChange}
                  onRemoveChange={onRemoveChange}
                />
              ))}
            </div>
          )}

          <div className={styles.actionButtons}>
            <button
              type='button'
              className={styles.addButton}
              onClick={onAddChange}
            >
              <Icon name='PlusIcon' />
              <Trans>Ajouter un changement</Trans>
            </button>

            {changes.length > 0 && onClearAll && (
              <button
                type='button'
                className={styles.clearButton}
                onClick={onClearAll}
              >
                <Icon name='TrashIcon' />
                <Trans>Tout supprimer</Trans>
              </button>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
