import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Cross2Icon,
  DownloadIcon,
  GearIcon,
  ImageIcon,
  InfoCircledIcon,
  PlusIcon,
  ReloadIcon,
  UploadIcon
} from '@radix-ui/react-icons'

// Mapping statique des icônes pour éviter l'accès dynamique
const ICON_MAP = {
  PlusIcon,
  Cross2Icon,
  DownloadIcon,
  GearIcon,
  ImageIcon,
  InfoCircledIcon,
  ReloadIcon,
  UploadIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon
} as const

// Types d'icônes disponibles
export type IconName = keyof typeof ICON_MAP

interface IconProps {
  name: IconName
  className?: string
  size?: number
  'aria-hidden'?: boolean
}

export default function Icon({
  name,
  className = '',
  size = 16,
  'aria-hidden': ariaHidden = true
}: IconProps) {
  // Récupérer le composant d'icône depuis le mapping statique
  const IconComponent = ICON_MAP[name]

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in icon mapping`)
    return null
  }

  return (
    <IconComponent
      className={className}
      width={size}
      height={size}
      aria-hidden={ariaHidden}
    />
  )
}
