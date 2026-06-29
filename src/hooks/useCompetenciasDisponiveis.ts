import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { competenciaAtual } from '../utils/notas'
import type { Competencia } from '../types'

export function useCompetenciasDisponiveis() {
  return useQuery({
    queryKey: ['competencias-disponiveis'],
    queryFn: async (): Promise<Competencia[]> => {
      const [{ data: avData }, { data: nutriData }] = await Promise.all([
        supabase.from('avaliacoes').select('competencia_mes, competencia_ano'),
        supabase.from('nutri_avaliacoes').select('competencia_mes, competencia_ano'),
      ])
      const map = new Map<string, Competencia>()
      // Competência atual sempre presente no topo
      const atual = competenciaAtual()
      map.set(`${atual.ano}-${String(atual.mes).padStart(2, '0')}`, atual)
      for (const r of [...(avData ?? []), ...(nutriData ?? [])] as { competencia_mes: number; competencia_ano: number }[]) {
        const k = `${r.competencia_ano}-${String(r.competencia_mes).padStart(2, '0')}`
        if (!map.has(k)) map.set(k, { mes: r.competencia_mes, ano: r.competencia_ano })
      }
      return Array.from(map.values()).sort((a, b) =>
        a.ano !== b.ano ? b.ano - a.ano : b.mes - a.mes
      )
    },
    staleTime: 1000 * 60 * 5,
  })
}
