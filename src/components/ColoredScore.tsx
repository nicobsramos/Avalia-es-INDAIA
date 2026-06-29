import { corClasse, formatarNota } from '../utils/notas'

interface Props {
  nota: number | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-bold',
  lg: 'text-2xl font-bold',
  xl: 'text-4xl font-extrabold',
}

export function ColoredScore({ nota, size = 'md', className = '' }: Props) {
  return (
    <span className={`${sizeMap[size]} ${corClasse(nota)} ${className}`}>
      {formatarNota(nota)}
    </span>
  )
}
