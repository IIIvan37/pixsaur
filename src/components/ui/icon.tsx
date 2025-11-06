import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Cross2Icon,
  DownloadIcon,
  FileIcon,
  GearIcon,
  GitHubLogoIcon,
  ImageIcon,
  InfoCircledIcon,
  LockClosedIcon,
  PlusIcon,
  ReloadIcon,
  TrashIcon,
  UploadIcon
} from '@radix-ui/react-icons'
import { logger } from '@/utils/logger'

// Mapping statique des icônes pour éviter l'accès dynamique
const ICON_MAP = {
  PlusIcon,
  Cross2Icon,
  DownloadIcon,
  FileIcon,
  GearIcon,
  GitHubLogoIcon,
  ImageIcon,
  InfoCircledIcon,
  LockClosedIcon,
  ReloadIcon,
  TrashIcon,
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
  readonly name: IconName
  readonly className?: string
  readonly size?: number
  readonly 'aria-hidden'?: boolean
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
    logger.warn(`Icon "${name}" not found in icon mapping`)
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
