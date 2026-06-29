import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Setor, ChecklistItem, Unidade } from '../types'

export interface SecaoComItens {
  titulo: string
  itens: ChecklistItem[]
}

export interface SetorComItens {
  setor: Setor
  secoes: SecaoComItens[]
}

export function useChecklist() {
  return useQuery({
    queryKey: ['checklist'],
    queryFn: async (): Promise<SetorComItens[]> => {
      const [{ data: setores }, { data: itens }] = await Promise.all([
        supabase.from('setores').select('*').order('ordem'),
        supabase.from('checklist_itens').select('*').eq('ativo', true).order('ordem'),
      ])

      const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

      return ((setores ?? []) as Setor[])
        .filter((s) => SETORES_OP.includes(s.nome))
        .map((s) => {
          const setorItens = ((itens ?? []) as ChecklistItem[]).filter((i) => i.setor_id === s.id)

          const secoesMap = new Map<string, ChecklistItem[]>()
          for (const item of setorItens) {
            const key = item.secao ?? 'Geral'
            if (!secoesMap.has(key)) secoesMap.set(key, [])
            secoesMap.get(key)!.push(item)
          }

          return {
            setor: s,
            secoes: Array.from(secoesMap.entries()).map(([titulo, its]) => ({ titulo, itens: its })),
          }
        })
    },
    staleTime: 1000 * 60 * 15,
  })
}

export function useUnidades() {
  return useQuery({
    queryKey: ['unidades'],
    queryFn: async (): Promise<Unidade[]> => {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Unidade[]
    },
    staleTime: 1000 * 60 * 10,
  })
}
