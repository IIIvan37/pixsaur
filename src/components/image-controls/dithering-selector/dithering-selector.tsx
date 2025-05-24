import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import Flex from '@/components/ui/flex'
import { useAtom } from 'jotai'
import { ditheringAtom } from '@/app/store/config/config'

const MODES = [
  { value: 'floydSteinberg', label: 'Floyd–Steinberg' },
  { value: 'bayer2x2', label: 'Bayer 2x2' },
  { value: 'bayer4x4', label: 'Bayer 4x4' }
]

export function DitheringSelector() {
  const [cfg, setCfg] = useAtom(ditheringAtom)

  return (
    <Flex gap='var(--spacing-md)'>
      <label
        style={{
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-foreground)'
        }}
      >
        Mode de dithering
      </label>
      <Select
        value={cfg.mode}
        onValueChange={(value) =>
          setCfg({ ...cfg, mode: value as typeof cfg.mode })
        }
      >
        {MODES.map((mode) => (
          <SelectItem key={mode.value} value={mode.value}>
            {mode.label}
          </SelectItem>
        ))}
      </Select>

      <PixsaurSlider
        label='Intensité'
        min={0}
        max={100}
        value={Math.round(cfg.intensity * 100)}
        onChange={(val) => setCfg({ ...cfg, intensity: val / 100 })}
        step={1}
      />
    </Flex>
  )
}
