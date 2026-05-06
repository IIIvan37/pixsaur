import { Trans } from '@lingui/react/macro'
import { useAtom, useSetAtom } from 'jotai'
import { reinitializeProcessorsAtom } from '@/app/store/adapters/processors'
import { processorTypeAtom } from '@/app/store/config/config'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import { isDevelopment } from '@/core'

const PROCESSOR_TYPES = [
  { value: 'auto', label: 'Auto (GPU puis CPU)' },
  { value: 'gpu', label: 'GPU (ReGL, strict)' },
  { value: 'cpu', label: 'CPU' }
] as const

export function ProcessorSelector() {
  const [processorType, setProcessorType] = useAtom(processorTypeAtom)
  const reinitializeProcessors = useSetAtom(reinitializeProcessorsAtom)

  const handleProcessorChange = async (value: string) => {
    setProcessorType(value as typeof processorType)
    // Forcer la réinitialisation des processeurs
    await reinitializeProcessors()
  }

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
      <Flex direction='column' gap='var(--spacing-xs)' align='flex-start'>
        <div
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-foreground)'
          }}
        >
          <Trans>Processeur</Trans>
        </div>
        <Select value={processorType} onValueChange={handleProcessorChange}>
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
