
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
  slotIndex: number;
  focusedColorIndex: number;
  onColorSelect: (color: CPCColor, slotIndex: number) => void;
  onToggleLock: (index: number) => void;
  colorOptionRefs: React.RefObject<(HTMLButtonElement | null)[]>;
  optionRefs: React.RefObject<(HTMLButtonElement | null)[]>;
  onClose: () => void;
};

export function ColorGridView({
  fullPalette,
  slots,
  slotIndex,
  focusedColorIndex,
  onColorSelect,
  onToggleLock,
  colorOptionRefs,
  optionRefs,
  onClose
}: ColorGridViewProps) {
  // Helper to check if a color is used in the palette (excluding current slot)
  const isColorUsed = (s: PaletteSlot, pc: CPCColor, index: number) => {
    return s.color && index !== slotIndex && Array.from(s.color).every((v, j) => v === pc.vector[j]);
  };
  const slot = slots[slotIndex];
  return (
    <div className="popover" style={{ position: 'relative', minHeight: 140, maxHeight: 260 }}>
      <div
        className={styles.colorGrid}
        role='listbox'
        aria-label='Options de couleur'
      >
        {fullPalette.map((pc: CPCColor, optionIndex: number) => {
          const isUsed = slots.some((s: PaletteSlot, i: number) => isColorUsed(s, pc, i));
          return (
            <div key={optionIndex}>
              <ColorButton
                colorHex={`#${pc.hex}`}
                className={clsx(
                  styles.colorOption,
                  isUsed && styles.colorOptionUsed
                )}
                title={`${pc.name}${isUsed ? ' (utilisée)' : ''}`}
                role='option'
                aria-selected={focusedColorIndex === optionIndex}
                disabled={isUsed}
                tabIndex={focusedColorIndex === optionIndex ? 0 : -1}
                buttonRef={(el: HTMLButtonElement | null) => {
                  React.useEffect(() => {
                    if (colorOptionRefs) colorOptionRefs.current[optionIndex] = el;
                    optionRefs.current[optionIndex] = el;
                    return () => {
                      if (colorOptionRefs) colorOptionRefs.current[optionIndex] = null;
                      optionRefs.current[optionIndex] = null;
                    };
                  }, [el, optionIndex]);
                }}
                onClick={() => onColorSelect(pc, slotIndex)}
              />
            </div>
          );
        })}
      </div>
      {/* Affiche le bouton lock uniquement si le slot est rempli */}
      {slot.color && (
        <Button
          className={styles.lockButton}
          variant="secondary"
          onClick={() => {
            onToggleLock(slotIndex);
            onClose();
          }}
        >
          {slot.locked ? 'Déverrouiller' : 'Verrouiller'}
        </Button>
      )}
    </div>
  )
}
