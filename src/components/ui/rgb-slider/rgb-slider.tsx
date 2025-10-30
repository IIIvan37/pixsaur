import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useCallback, useState } from "react";
import type { Vector } from "@/libs/pixsaur-color/src/type";
import Flex from "../flex";
import PixsaurSlider from "../slider";
import styles from "./rgb-slider.module.css";

export interface RgbSliderProps {
  readonly value: Vector;
  readonly onChange: (value: Vector) => void;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly showPreview?: boolean;
  readonly hardware?: "classic" | "plus"; // CPC Classic (0,128,255) ou CPC Plus (16 niveaux)
}

/**
 * RGB Slider Component - Hardware-Aware Implementation
 *
 * Composant réutilisable pour ajuster les valeurs RGB avec sliders.
 * Travaille en valeurs normalisées (0-15 pour Plus, 0-2 pour Classic)
 * et convertit automatiquement vers RGB 0-255.
 *
 * En mode CPC Classic: 3 niveaux (0, 128, 255)
 * En mode CPC Plus: 16 niveaux 4-bit (0, 17, 34, ..., 255)
 */
export function RgbSlider({
  value,
  onChange,
  disabled = false,
  label = "RGB",
  showPreview = true,
  hardware = "classic",
}: RgbSliderProps) {
  const { _ } = useLingui();
  const [localValue, setLocalValue] = useState(value);

  // Convertit RGB (0-255) vers valeur normalisée du slider
  const toSliderValue = useCallback(
    (rgbValue: number): number => {
      if (hardware === "classic") {
        // 0 → 0, 128 → 1, 255 → 2
        if (rgbValue <= 64) return 0;
        if (rgbValue <= 192) return 1;
        return 2;
      }
      // Plus: 4-bit (0-15)
      return Math.round((rgbValue / 255) * 15);
    },
    [hardware]
  );

  // Convertit valeur normalisée du slider vers RGB (0-255)
  const toRgbValue = useCallback(
    (sliderValue: number): number => {
      if (hardware === "classic") {
        // 0 → 0, 1 → 128, 2 → 255
        const classicValues = [0, 128, 255];
        return classicValues[sliderValue] ?? 0;
      }
      // Plus: 4-bit to RGB
      return Math.round((sliderValue / 15) * 255);
    },
    [hardware]
  );

  const handleChange = useCallback(
    (component: "r" | "g" | "b", sliderValue: number) => {
      let componentIndex: number;
      if (component === "r") {
        componentIndex = 0;
      } else if (component === "g") {
        componentIndex = 1;
      } else {
        componentIndex = 2;
      }

      const rgbValue = toRgbValue(sliderValue);
      const updated = [...localValue] as Vector;
      updated[componentIndex] = rgbValue;
      setLocalValue(updated);
      onChange(updated);
    },
    [localValue, onChange, toRgbValue]
  );

  const [r, g, b] = localValue;
  const maxSliderValue = hardware === "classic" ? 2 : 15;

  return (
    <div className={styles.container}>
      {label && <div className={styles.label}>{label}</div>}

      <Flex direction="column" gap="small">
        <PixsaurSlider
          min={0}
          max={maxSliderValue}
          value={toSliderValue(r)}
          onChange={(val) => handleChange("r", val)}
          disabled={disabled}
          label={`${_(msg`Rouge`)} (${r})`}
          hideLabel={false}
        />

        <PixsaurSlider
          min={0}
          max={maxSliderValue}
          value={toSliderValue(g)}
          onChange={(val) => handleChange("g", val)}
          disabled={disabled}
          label={`${_(msg`Vert`)} (${g})`}
          hideLabel={false}
        />

        <PixsaurSlider
          min={0}
          max={maxSliderValue}
          value={toSliderValue(b)}
          onChange={(val) => handleChange("b", val)}
          disabled={disabled}
          label={`${_(msg`Bleu`)} (${b})`}
          hideLabel={false}
        />

        {showPreview && (
          <div
            className={styles.preview}
            style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
            title={`RGB(${r}, ${g}, ${b})`}
          />
        )}
      </Flex>
    </div>
  );
}
