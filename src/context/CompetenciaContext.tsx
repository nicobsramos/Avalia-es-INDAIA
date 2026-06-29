import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Competencia } from '../types'
import { competenciaAtual } from '../utils/notas'

interface CompetenciaContextValue {
  competencia: Competencia
  setCompetencia: (c: Competencia) => void
}

const CompetenciaContext = createContext<CompetenciaContextValue | null>(null)

export function CompetenciaProvider({ children }: { children: ReactNode }) {
  const [competencia, setCompetencia] = useState<Competencia>(competenciaAtual)

  return (
    <CompetenciaContext.Provider value={{ competencia, setCompetencia }}>
      {children}
    </CompetenciaContext.Provider>
  )
}

export function useCompetencia() {
  const ctx = useContext(CompetenciaContext)
  if (!ctx) throw new Error('useCompetencia must be inside CompetenciaProvider')
  return ctx
}
