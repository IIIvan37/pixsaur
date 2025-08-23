
import * as React from 'react';
import Button from '@/components/ui/button';
import type { PaletteSlot } from '@/app/store/palette/types';
import type { CPCColor } from '@/libs/types';
import styles from './color-grid.module.css';
import { ColorButton } from '../color-slot/color-button';
import clsx from 'clsx';

export type ColorGridViewProps = {
  fullPalette: CPCColor[];
  slots: PaletteSlot[];
  slotIdx: number;
  focusedColorIdx: number;
  onColorSelect: (color: CPCColor, slotIdx: number) => void;
  onToggleLock: (idx: number) => void;
  colorOptionRefs: React.RefObject<HTMLButtonElement[]>;
  optionRefs: React.RefObject<HTMLButtonElement[]>;
  onClose: () => void;
};

export function ColorGridView({
  fullPalette,
  slots,
  slotIdx,
  focusedColorIdx,
  onColorSelect,
  onToggleLock,
  colorOptionRefs,
  optionRefs,
  onClose
}: ColorGridViewProps) {
  const slot = slots[slotIdx];
  return (
    <div className="popover" style={{ position: 'relative', minHeight: 140, maxHeight: 260 }}>
      <div
        className={styles.colorGrid}
        role='listbox'
        aria-label='Options de couleur'
      >
        {fullPalette.map((pc: CPCColor, optionIdx: number) => {
          const isUsed = slots.some((s: PaletteSlot, i: number) => {
            if (i === slotIdx) return false;
            if (!s.color) return false;
            return Array.from(s.color).every((v: number, j: number) => v === pc.vector[j]);
          });
          return (
            <div key={optionIdx}>
              <ColorButton
                colorHex={`#${pc.hex}`}
                className={clsx(
                  styles.colorOption,
                  isUsed && styles.colorOptionUsed
                )}
                title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
                role='option'
                aria-selected={focusedColorIdx === optionIdx}
                disabled={isUsed}
                tabIndex={focusedColorIdx === optionIdx ? 0 : -1}
                buttonRef={(el: HTMLButtonElement | null) => {
                  if (colorOptionRefs && el)
                    colorOptionRefs.current[optionIdx] = el;
                  if (el) optionRefs.current[optionIdx] = el;
                }}
                onClick={() => onColorSelect(pc, slotIdx)}
              />
            </div>
          );
        })}
      </div>
      {/* Affiche le bouton lock uniquement si le slot est rempli */}
      {slot.color && (
        <Button
          variant="secondary"
          style={{
            position: 'absolute',
            bottom: 10,
            right: 6,
            fontWeight: 600,
            fontSize: '1rem',
            minWidth: 80,
            paddingRight: 8,
            paddingLeft: 8
          }}
          onClick={() => {
            onToggleLock(slotIdx);
            onClose();
          }}
        >
          {slot.locked ? 'Déverrouiller' : 'Verrouiller'}
        </Button>
      )}
    </div>
  )
}
