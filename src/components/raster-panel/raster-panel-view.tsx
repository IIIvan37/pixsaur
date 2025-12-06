import { Trans } from '@lingui/react/macro'
import { useId } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import Icon from '@/components/ui/icon'
import { Switch } from '@/components/ui/switch/switch'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import styles from './raster-panel.module.css'

export interface RasterPanelViewProps {
  readonly enabled: boolean
  readonly onEnabledChange: (enabled: boolean) => void
  readonly ranges: RasterRange[]
  readonly conflicts: string[]
  readonly maxLine: number
  readonly onAddRange: () => void
  readonly onUpdateRange: (
    id: string,
    field: keyof Omit<RasterRange, 'id'>,
    value: number | Vector<'RGB'>
  ) => void
  readonly onRemoveRange: (id: string) => void
}

function rgbToHex(color: Vector<'RGB'>): string {
  return `#${color[0].toString(16).padStart(2, '0')}${color[1]
    .toString(16)
    .padStart(2, '0')}${color[2].toString(16).padStart(2, '0')}`
}

function hexToRgb(hex: string): Vector<'RGB'> {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ]
}

export function RasterPanelView({
  enabled,
  onEnabledChange,
  ranges,
  conflicts,
  maxLine,
  onAddRange,
  onUpdateRange,
  onRemoveRange
}: RasterPanelViewProps) {
  const switchId = useId()

  return (
    <CollapsibleSection
      title={<Trans>Raster Effects</Trans>}
      defaultOpen={false}
    >
      <div className={styles.container}>
        <div className={styles.infoBox}>
          <Trans>
            Define ink color changes per line range. Preview only - export data
            remains unchanged.
          </Trans>
        </div>

        <div className={styles.toggleRow}>
          <Switch
            id={switchId}
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <span className={styles.toggleLabel}>
            <Trans>Enable raster preview</Trans>
          </span>
        </div>

        {enabled && (
          <>
            {ranges.length === 0 ? (
              <div className={styles.emptyState}>
                <Trans>No raster ranges defined. Add a range to start.</Trans>
              </div>
            ) : (
              <div className={styles.rangesList}>
                {ranges.map((range, index) => {
                  const hasConflict = conflicts.includes(range.id)
                  return (
                    <div
                      key={range.id}
                      className={`${styles.rangeItem} ${hasConflict ? styles.conflict : ''}`}
                    >
                      <div className={styles.rangeHeader}>
                        <span className={styles.rangeTitle}>
                          <Trans>Range {index + 1}</Trans>
                        </span>
                        <button
                          type='button'
                          className={styles.deleteButton}
                          onClick={() => onRemoveRange(range.id)}
                          title='Remove range'
                        >
                          <Icon name='TrashIcon' />
                        </button>
                      </div>

                      <div className={styles.rangeFields}>
                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>
                            <Trans>Start line</Trans>
                          </span>
                          <input
                            type='number'
                            className={styles.fieldInput}
                            value={range.startLine}
                            min={0}
                            max={maxLine}
                            onChange={(e) =>
                              onUpdateRange(
                                range.id,
                                'startLine',
                                Math.max(
                                  0,
                                  Math.min(
                                    maxLine,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                )
                              )
                            }
                          />
                        </label>

                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>
                            <Trans>End line</Trans>
                          </span>
                          <input
                            type='number'
                            className={styles.fieldInput}
                            value={range.endLine}
                            min={0}
                            max={maxLine}
                            onChange={(e) =>
                              onUpdateRange(
                                range.id,
                                'endLine',
                                Math.max(
                                  0,
                                  Math.min(
                                    maxLine,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                )
                              )
                            }
                          />
                        </label>
                      </div>

                      <div className={styles.inkColorRow}>
                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>
                            <Trans>Ink</Trans>
                          </span>
                          <input
                            type='number'
                            className={styles.fieldInput}
                            value={range.inkIndex}
                            min={0}
                            max={15}
                            onChange={(e) =>
                              onUpdateRange(
                                range.id,
                                'inkIndex',
                                Math.max(
                                  0,
                                  Math.min(
                                    15,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                )
                              )
                            }
                          />
                        </label>

                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>
                            <Trans>Color</Trans>
                          </span>
                          <div className={styles.colorPreview}>
                            <input
                              type='color'
                              className={styles.colorSwatch}
                              value={rgbToHex(range.color)}
                              onChange={(e) =>
                                onUpdateRange(
                                  range.id,
                                  'color',
                                  hexToRgb(e.target.value)
                                )
                              }
                            />
                            <span className={styles.colorValue}>
                              {rgbToHex(range.color).toUpperCase()}
                            </span>
                          </div>
                        </label>
                      </div>

                      {hasConflict && (
                        <div className={styles.conflictWarning}>
                          <Trans>
                            Warning: This range overlaps with another range on
                            the same ink.
                          </Trans>
                        </div>
                      )}
                    </div>
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
              <Trans>Add raster range</Trans>
            </button>
          </>
        )}
      </div>
    </CollapsibleSection>
  )
}
