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
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCColor } from '@/libs/types'
import { vectorToHex } from '@/palettes/cpc-palette'
import styles from './raster-panel.module.css'

export interface RasterPanelViewProps {
  readonly disabled?: boolean
  readonly enabled: boolean
  readonly onEnabledChange: (enabled: boolean) => void
  readonly changes: RasterChange[]
  readonly conflicts: string[]
  readonly maxLine: number
  readonly palette: Vector[]
  readonly nColors: number
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
 * Compact change row - single line with all controls
 */
function ChangeRow({
  change,
  index,
  hasConflict,
  maxLine,
  palette,
  nColors,
  cpcPalette,
  isClassicMode,
  onUpdate,
  onRemove
}: {
  change: RasterChange
  index: number
  hasConflict: boolean
  maxLine: number
  palette: Vector[]
  nColors: number
  cpcPalette: CPCColor[]
  isClassicMode: boolean
  onUpdate: (
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  onRemove: () => void
}) {
  const { _ } = useLingui()
  return (
    <div
      className={`${styles.changeRow} ${hasConflict ? styles.conflict : ''}`}
    >
      {/* Change number */}
      <span className={styles.changeNumber}>{index + 1}</span>

      {/* Line slider */}
      <div className={styles.lineSliderGroup}>
        <span className={styles.sliderValue}>{change.line}</span>
        <PixsaurSlider
          min={0}
          max={maxLine}
          value={change.line}
          onChange={(val) => onUpdate('line', val)}
          hideLabel
          showTooltip={false}
        />
      </div>

      {/* Ink selector */}
      <div className={styles.inkGroup}>
        <InkSelector
          palette={palette}
          nColors={nColors}
          selectedInk={change.inkIndex}
          onSelectInk={(ink) => {
            onUpdate('inkIndex', ink)
            // When changing ink, use the palette color for that ink
            const inkColor = palette[ink] || [0, 0, 0]
            onUpdate('color', inkColor as Vector<'RGB'>)
          }}
        />
      </div>

      {/* Color picker */}
      <ColorTrigger
        color={change.color}
        cpcPalette={cpcPalette}
        isClassicMode={isClassicMode}
        onColorChange={(c) => onUpdate('color', c)}
      />

      {/* Delete button */}
      <button
        type='button'
        className={styles.deleteButton}
        onClick={onRemove}
        title={_(msg`Supprimer le changement`)}
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
  changes,
  conflicts,
  maxLine,
  palette,
  nColors,
  cpcPalette,
  isClassicMode,
  isPlusMode,
  onAddChange,
  onUpdateChange,
  onRemoveChange,
  onClearAll
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
          <div className={styles.modeInfo}>
            <span className={styles.modeBadge}>
              {isPlusMode ? 'CPC Plus' : 'CPC Classic'}
            </span>
            <span className={styles.modeHint}>
              <Trans>Raster: changements d'encre par ligne</Trans>
            </span>
          </div>
        )}

        {enabled && (
          <>
            {changes.length > 0 && (
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>#</span>
                <span className={styles.headerLabel}>
                  <Trans>Ligne</Trans>
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

            {changes.length === 0 ? (
              <div className={styles.emptyState}>
                <Trans>Aucun changement raster défini.</Trans>
              </div>
            ) : (
              <div className={styles.changesList}>
                {changes.map((change, index) => (
                  <ChangeRow
                    key={change.id}
                    change={change}
                    index={index}
                    hasConflict={conflicts.includes(change.id)}
                    maxLine={maxLine}
                    palette={palette}
                    nColors={nColors}
                    cpcPalette={cpcPalette}
                    isClassicMode={isClassicMode}
                    onUpdate={(field, value) =>
                      onUpdateChange(change.id, field, value)
                    }
                    onRemove={() => onRemoveChange(change.id)}
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
          </>
        )}
      </div>
    </CollapsibleSection>
  )
}
