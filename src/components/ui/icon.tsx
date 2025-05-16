import * as RadixIcons from '@radix-ui/react-icons'

// Types d'icônes disponibles
export type IconName = keyof typeof RadixIcons

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
  // Récupérer dynamiquement le composant d'icône
  const IconComponent = RadixIcons[name]

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Radix Icons`)
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
