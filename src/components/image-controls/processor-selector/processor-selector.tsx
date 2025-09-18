import { useAtom } from 'jotai'
import { processorTypeAtom } from '@/app/store/config/config'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import { isDevelopment } from '@/utils/is-development'

const PROCESSOR_TYPES = [
  { value: 'auto', label: '🤖 Auto (GPU puis CPU)', icon: '🤖' },
  { value: 'gpu', label: '🎮 GPU (ReGL)', icon: '🎮' },
  { value: 'cpu', label: '🖥️ CPU', icon: '🖥️' }
] as const

export function ProcessorSelector() {
  const [processorType, setProcessorType] = useAtom(processorTypeAtom)

  // N'afficher le sélecteur qu'en mode développement
  if (!isDevelopment()) {
    return null
  }

  return (
    <Flex
      gap='var(--spacing-md)'
      wrap='wrap'
      justify='flex-start'
      align='flex-start'
    >
      <Flex direction='column' gap='var(--spacing-xs)' align='start'>
        <div
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-foreground)'
          }}
        >
          Processeur
        </div>
        <Select
          value={processorType}
          onValueChange={(value) =>
            setProcessorType(value as typeof processorType)
          }
        >
          {PROCESSOR_TYPES.map((processor) => (
            <SelectItem key={processor.value} value={processor.value}>
              {processor.label}
            </SelectItem>
          ))}
        </Select>
      </Flex>
    </Flex>
  )
}
