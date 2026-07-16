import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ChecklistCozinhaItem {
  id: string
  tipo: 'abertura' | 'fechamento'
  secao: string
  descricao: string
  ordem: number
  ativo: boolean
  setor: string | null
}

export interface ChecklistCozinha {
  id: string
  usuario_id: string
  unidade_id: string
  tipo: 'abertura' | 'fechamento'
  data_operacao: string
  responsavel: string
  obs_gerais: string | null
  criado_em: string
  setor: string | null
}

export interface ChecklistResposta {
  id: string
  checklist_id: string
  item_id: string
  feito: boolean
  observacao: string | null
}

export interface ChecklistCompliance {
  unidade_id: string
  unidade_nome: string
  dias_operacao_semana: number
  abertura: number
  fechamento: number
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function diasDecorridosSemana(): number {
  const dia = new Date().getDay()
  return dia === 0 ? 6 : dia
}

// Maps setores_avaliacao values (which can be granular like "Atendimento - Maitres")
// to the simpler checklist sector names ('Cozinha', 'Bar', 'Atendimento')
export function toChecklistSetores(setoresAvaliacao: string[]): string[] {
  const result = new Set<string>()
  for (const s of setoresAvaliacao) {
    if (s.startsWith('Cozinha')) result.add('Cozinha')
    else if (s.startsWith('Bar')) result.add('Bar')
    else if (s.startsWith('Atendimento')) result.add('Atendimento')
  }
  return Array.from(result)
}

export function useChecklistItens(tipo: 'abertura' | 'fechamento', setoresFilter?: string[]) {
  return useQuery({
    queryKey: ['checklist-cozinha-itens', tipo, setoresFilter],
    queryFn: async (): Promise<ChecklistCozinhaItem[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('checklist_cozinha_itens')
        .select('*')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .order('ordem')
      // Filtra no banco — não depende só do client-side para evitar vazamento entre setores
      if (setoresFilter && setoresFilter.length > 0) {
        q = q.in('setor', setoresFilter)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ChecklistCozinhaItem[]
    },
    staleTime: 1000 * 60 * 60,
  })
}

export function useChecklistList(unidadeIds?: string[] | null, setores?: string[] | null) {
  return useQuery({
    queryKey: ['checklist-cozinha-list', unidadeIds, setores],
    queryFn: async (): Promise<(ChecklistCozinha & { unidade: { nome: string } })[]> => {
      // Array vazio explícito = usuário sem setor configurado → retorna nada (sem vazamento entre setores)
      if (Array.isArray(setores) && setores.length === 0) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('checklist_cozinha')
        .select('*, unidade:unidades(nome)')
        .order('data_operacao', { ascending: false })
        .order('tipo')
        .limit(90)

      if (unidadeIds && unidadeIds.length > 0) q = q.in('unidade_id', unidadeIds)
      if (setores && setores.length > 0) q = q.in('setor', setores)

      const { data, error } = await q
      if (error) throw error

      const rows = (data ?? []) as (ChecklistCozinha & { unidade: { nome: string }; setor: string | null })[]

      // Filtro client-side como garantia: nunca vazar checklists de outros setores
      if (setores && setores.length > 0) {
        return rows.filter((c) => c.setor !== null && setores.includes(c.setor))
      }
      return rows
    },
    enabled: !unidadeIds || unidadeIds.length > 0,
  })
}

export function useChecklistDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist-cozinha-detalhe', id],
    queryFn: async () => {
      const [{ data: ck, error: e1 }, { data: respostas, error: e2 }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('checklist_cozinha')
          .select('*, unidade:unidades(nome)')
          .eq('id', id!)
          .single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('checklist_cozinha_respostas')
          .select('*')
          .eq('checklist_id', id!),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return {
        checklist: ck as ChecklistCozinha & { unidade: { nome: string } },
        respostas: (respostas ?? []) as ChecklistResposta[],
      }
    },
    enabled: !!id,
  })
}

export function useChecklistExistente(
  unidadeId: string | undefined,
  tipo: 'abertura' | 'fechamento',
  data: string,
  setor?: string | null,
) {
  return useQuery({
    queryKey: ['checklist-existente', unidadeId, tipo, data, setor],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('checklist_cozinha')
        .select('id, usuario_id')
        .eq('unidade_id', unidadeId!)
        .eq('tipo', tipo)
        .eq('data_operacao', data)
      // Filtra pelo setor do usuário para Bar não conflitar com Cozinha na mesma unidade
      if (setor) q = q.eq('setor', setor)
      const { data: result, error } = await q
        .maybeSingle()
      if (error) throw error
      return result as { id: string; usuario_id: string } | null
    },
    enabled: !!unidadeId,
  })
}

export function useChecklistCompliance(unidadeIds?: string[] | null, setores?: string[] | null) {
  const monday = getMondayOfWeek(new Date())
  const today = new Date()
  const mondayStr = toDateStr(monday)
  const todayStr = toDateStr(today)

  return useQuery({
    queryKey: ['checklist-compliance', mondayStr, todayStr, unidadeIds, setores],
    queryFn: async (): Promise<ChecklistCompliance[]> => {
      if (unidadeIds !== null && unidadeIds !== undefined && unidadeIds.length === 0) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let unidadesQ = (supabase as any)
        .from('unidades')
        .select('id, nome, dias_operacao_semana')
        .eq('ativo', true)
        .order('nome')
      if (unidadeIds && unidadeIds.length > 0) unidadesQ = unidadesQ.in('id', unidadeIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let checklistsQ = (supabase as any)
        .from('checklist_cozinha')
        .select('unidade_id, tipo')
        .gte('data_operacao', mondayStr)
        .lte('data_operacao', todayStr)
      if (setores && setores.length > 0) checklistsQ = checklistsQ.in('setor', setores)

      const [{ data: unidades, error: e1 }, { data: checklists, error: e2 }] = await Promise.all([
        unidadesQ,
        checklistsQ,
      ])
      if (e1) throw e1
      if (e2) throw e2

      const counts: Record<string, { abertura: number; fechamento: number }> = {}
      for (const c of checklists ?? []) {
        if (!counts[c.unidade_id]) counts[c.unidade_id] = { abertura: 0, fechamento: 0 }
        if (c.tipo === 'abertura') counts[c.unidade_id].abertura++
        else counts[c.unidade_id].fechamento++
      }

      return ((unidades ?? []) as { id: string; nome: string; dias_operacao_semana: number | null }[]).map((u) => ({
        unidade_id: u.id,
        unidade_nome: u.nome,
        dias_operacao_semana: u.dias_operacao_semana ?? 6,
        abertura: counts[u.id]?.abertura ?? 0,
        fechamento: counts[u.id]?.fechamento ?? 0,
      }))
    },
    staleTime: 1000 * 60 * 2,
  })
}

interface SalvarInput {
  id?: string
  usuario_id: string
  unidade_id: string
  tipo: 'abertura' | 'fechamento'
  data_operacao: string
  responsavel: string
  obs_gerais: string
  setor?: string | null
  respostas: { item_id: string; feito: boolean; observacao: string }[]
}

export function useSalvarChecklist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, usuario_id, unidade_id, tipo, data_operacao, responsavel, obs_gerais, setor, respostas }: SalvarInput) => {
      let checklistId: string

      if (id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('checklist_cozinha')
          .update({ responsavel, obs_gerais: obs_gerais || null })
          .eq('id', id)
        if (error) throw error
        checklistId = id
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('checklist_cozinha')
          .insert({ usuario_id, unidade_id, tipo, data_operacao, responsavel, obs_gerais: obs_gerais || null, setor: setor ?? null })
          .select('id')
          .single()
        if (error) throw error
        checklistId = (data as { id: string }).id
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rErr } = await (supabase as any)
        .from('checklist_cozinha_respostas')
        .upsert(
          respostas.map((r) => ({
            checklist_id: checklistId,
            item_id: r.item_id,
            feito: r.feito,
            observacao: r.observacao || null,
          })),
          { onConflict: 'checklist_id,item_id' },
        )
      if (rErr) throw rErr

      return checklistId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-cozinha-list'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-compliance'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-existente'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-cozinha-detalhe'] })
    },
  })
}

export function useDeleteChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token ?? ''
      const res = await fetch(`/api/delete-checklist?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Erro ao apagar')
      }
    },
    onSuccess: (_, id) => {
      // Remove o item do cache imediatamente para a UI refletir antes do refetch
      queryClient.setQueriesData(
        { queryKey: ['checklist-cozinha-list'] },
        (old: unknown) => {
          if (!Array.isArray(old)) return old
          return old.filter((c: { id: string }) => c.id !== id)
        },
      )
      queryClient.invalidateQueries({ queryKey: ['checklist-cozinha-list'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-compliance'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-existente'] })
      queryClient.invalidateQueries({ queryKey: ['checklist-cozinha-detalhe'] })
    },
  })
}
