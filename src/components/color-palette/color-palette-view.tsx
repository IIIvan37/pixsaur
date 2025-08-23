
// ColorPaletteView: Main palette UI component
// Handles popover logic, slot mapping, focus management, and accessibility
import { useRef, useState, useEffect } from 'react';
import styles from './color-palette.module.css';
import animStyles from '@/styles/animations.module.css';
import { PaletteSlot } from '@/app/store/palette/types';
import { CPCColor } from '@/libs/types';
import { ColorSlot } from './color-slot/color-slot';
import { EmptySlotButton } from './color-slot/empty.slot';
import { ColorGridView } from './color-grid/color-grid-view';
import PixsaurPopover from '@/components/ui/popover';

/**
 * Props for ColorPaletteView
 * @property slots - Array of palette slots
 * @property onToggleLock - Callback to toggle lock state for a slot
 * @property onSetColor - Callback to set color for a slot
 * @property fullPalette - Array of all available colors
 */
export type ColorPaletteViewProps = {
  slots: PaletteSlot[];
  onToggleLock: (idx: number) => void;
  onSetColor: (params: { index: number; color: CPCColor }) => void;
  fullPalette: CPCColor[];
};

export const ColorPaletteView = (
  { slots, onToggleLock, onSetColor, fullPalette }: ColorPaletteViewProps
) => {
  // openPopoverIndex: index of slot with open popover, or null
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  // focusedColorIdx: index of focused color option in popover
  const [focusedColorIdx, setFocusedColorIdx] = useState<number>(0);
  // buttonRefs: refs for slot buttons
  const buttonRefs = useRef<HTMLButtonElement[]>([]);
  // colorOptionRefs: refs for color option buttons in popover
  const colorOptionRefs = useRef<HTMLButtonElement[]>([]);

  // Ensure buttonRefs array matches slots length
  useEffect(() => {
    buttonRefs.current.length = slots.length;
  }, [slots.length]);

  // Reset focused color when popover opens
  useEffect(() => {
    if (openPopoverIndex !== null) setFocusedColorIdx(0);
  }, [openPopoverIndex]);

  // Focus the color option button when focusedColorIdx changes
  useEffect(() => {
    const btn = colorOptionRefs.current[focusedColorIdx];
    if (btn) setTimeout(() => btn.focus(), 0);
  }, [focusedColorIdx, openPopoverIndex]);

  // When popover opens, focus the first enabled color option
  useEffect(() => {
    if (openPopoverIndex !== null) {
      const firstEnabledIdx = fullPalette.findIndex((pc) => {
        return !slots.some((slot, i) => {
          if (i === openPopoverIndex) return false;
          if (!slot.color) return false;
          return Array.from(slot.color).every((v, j) => v === pc.vector[j]);
        });
      });
      if (firstEnabledIdx !== -1) setFocusedColorIdx(firstEnabledIdx);
    }
  }, [openPopoverIndex, fullPalette, slots]);

  /**
   * Handles color selection for a slot
   * @param color - Selected color
   * @param idx - Slot index
   */
  const handleColorSelect = (color: CPCColor, idx: number) => {
    onSetColor({ index: idx, color });
    setOpenPopoverIndex(null);
  };

  return (
    <div className={styles.container} role='region' aria-label='Palette de couleurs'>
      <div className={styles.paletteGrid}>
        {slots.map((slot, idx) => {
          const isPopoverOpen = openPopoverIndex === idx;
          return (
            <div
              key={idx}
              className={`${styles.colorSquare} ${animStyles.colorSquare}`}
              style={{ position: 'relative' }}
            >
              {slot.color ? (
                <PixsaurPopover
                  open={isPopoverOpen}
                  onOpenChange={(open) => setOpenPopoverIndex(open ? idx : null)}
                  trigger={
                    <ColorSlot
                      idx={idx}
                      color={slot.color}
                      locked={slot.locked}
                      buttonRef={(el) => {
                        if (el) buttonRefs.current[idx] = el;
                      }}
                      onToggleLock={onToggleLock}
                      onOpenPopover={() => {
                        setOpenPopoverIndex(idx);
                      }}
                      focused={openPopoverIndex === idx}
                    />
                  }
                >
                  <ColorGridView
                    fullPalette={fullPalette}
                    slots={slots}
                    slotIndex={idx}
                    focusedColorIndex={focusedColorIdx}
                    onColorSelect={(color) => handleColorSelect(color, idx)}
                    colorOptionRefs={colorOptionRefs}
                    optionRefs={colorOptionRefs}
                    onToggleLock={onToggleLock}
                    onClose={() => setOpenPopoverIndex(null)}
                  />
                </PixsaurPopover>
              ) : (
                <EmptySlotButton
                  idx={idx}
                  buttonRef={(el) => {
                    if (el) buttonRefs.current[idx] = el;
                  }}
                  open={isPopoverOpen}
                  onOpenChange={(open) => {
                    // Removed debug log
                    setOpenPopoverIndex(open ? idx : null);
                  }}
                  slots={slots}
                  fullPalette={fullPalette}
                  focusedColorIdx={focusedColorIdx}
                  onColorSelect={handleColorSelect}
                  colorOptionRefs={colorOptionRefs}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}