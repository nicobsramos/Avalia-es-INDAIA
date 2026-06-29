import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Competencia } from '../types'

// ---- tipos locais ----
export interface NutriItem {
  id: string
  area: 'Cozinha' | 'Bar' | 'Atendimento'
  descricao: string
  ordem: number
}

export interface NutriAvaliacaoRow {
  id: string
  usuario_id: string
  unidade_id: string
  data_visita: string
  competencia_mes: number
  competencia_ano: number
  lideres_presentes: string | null
  obs_cozinha: string | null
  obs_bar: string | null
  obs_atendimento: string | null
  relatorio_tecnico: string | null
  criado_em: string
  unidade_nome: string
  usuario_nome: string
}

export type ValorNutri = 'Conforme' | 'Nao_Conforme' | 'Nao_Aplicavel'

export interface NutriResposta {
  id: string
  avaliacao_id: string
  item_id: string
  valor: ValorNutri
  observacao: string | null
}

export interface NotaAreaNutri {
  area: 'Cozinha' | 'Bar' | 'Atendimento'
  nota: number | null
  conforme: number
  nao_conforme: number
  nao_aplicavel: number
  total: number
}

export interface NotaUnidadeNutri {
  unidade_id: string
  unidade_nome: string
  Cozinha: number | null
  Bar: number | null
  Atendimento: number | null
  consolidado: number | null
  visitas: number
}

// ---- helpers ----
function calcNota(conforme: number, total: number): number | null {
  if (total === 0) return null
  return (conforme / total) * 100
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ---- hooks ----

export function useNutriItens() {
  return useQuery({
    queryKey: ['nutri-itens'],
    queryFn: async (): Promise<Record<'Cozinha' | 'Bar' | 'Atendimento', NutriItem[]>> => {
      const { data, error } = await supabase
        .from('nutri_itens')
        .select('id, area, descricao, ordem')
        .eq('ativo', true)
        .order('area')
        .order('ordem')
      if (error) throw error
      const items = (data ?? []) as unknown as NutriItem[]
      return {
        Cozinha:     items.filter((i) => i.area === 'Cozinha'),
        Bar:         items.filter((i) => i.area === 'Bar'),
        Atendimento: items.filter((i) => i.area === 'Atendimento'),
      }
    },
    staleTime: Infinity,
  })
}

export function useNutriReport(competencia: Competencia) {
  return useQuery({
    queryKey: ['nutri-report', competencia.mes, competencia.ano],
    queryFn: async (): Promise<NotaUnidadeNutri[]> => {
      const { data: avaliacoes, error: avErr } = await supabase
        .from('nutri_avaliacoes')
        .select('id, unidade_id, unidades(nome)')
        .eq('competencia_mes', competencia.mes)
        .eq('competencia_ano', competencia.ano)
      if (avErr) throw avErr
      if (!avaliacoes || avaliacoes.length === 0) return []

      type AvRow = { id: string; unidade_id: string; unidades: { nome: string } | null }
      const avs = avaliacoes as unknown as AvRow[]
      const avIds = avs.map((a) => a.id)

      const { data: respostas, error: rsErr } = await supabase
        .from('nutri_respostas')
        .select('avaliacao_id, valor, nutri_itens(area)')
        .in('avaliacao_id', avIds)
      if (rsErr) throw rsErr

      type RsRow = { avaliacao_id: string; valor: string; nutri_itens: { area: string } | null }
      const rs = (respostas ?? []) as unknown as RsRow[]

      // map avaliacao_id → unidade_id
      const avToUnidade: Record<string, string> = {}
      const unidadeNomes: Record<string, string> = {}
      for (const av of avs) {
        avToUnidade[av.id] = av.unidade_id
        unidadeNomes[av.unidade_id] = av.unidades?.nome ?? av.unidade_id
      }

      type Acc = Record<string, Record<string, { conforme: number; total: number }>>
      const byUni: Acc = {}

      for (const r of rs) {
        const uid = avToUnidade[r.avaliacao_id]
        const area = r.nutri_itens?.area
        if (!uid || !area) continue
        if (!byUni[uid]) byUni[uid] = {}
        if (!byUni[uid][area]) byUni[uid][area] = { conforme: 0, total: 0 }
        if (r.valor !== 'Nao_Aplicavel') {
          byUni[uid][area].total++
          if (r.valor === 'Conforme') byUni[uid][area].conforme++
        }
      }

      const score = (d?: { conforme: number; total: number }) =>
        d ? calcNota(d.conforme, d.total) : null

      return Object.entries(byUni)
        .map(([uid, areas]) => {
          const C = score(areas['Cozinha'])
          const B = score(areas['Bar'])
          const A = score(areas['Atendimento'])
          const validas = [C, B, A].filter((n): n is number => n !== null)
          return {
            unidade_id: uid,
            unidade_nome: unidadeNomes[uid] ?? uid,
            Cozinha: C,
            Bar: B,
            Atendimento: A,
            consolidado: avg(validas),
            visitas: avs.filter((a) => a.unidade_id === uid).length,
          }
        })
        .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome))
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useNutriAvaliacoesList() {
  return useQuery({
    queryKey: ['nutri-avaliacoes'],
    queryFn: async (): Promise<NutriAvaliacaoRow[]> => {
      const { data, error } = await supabase
        .from('nutri_avaliacoes')
        .select('id, usuario_id, unidade_id, data_visita, competencia_mes, competencia_ano, lideres_presentes, criado_em, unidades(nome)')
        .order('criado_em', { ascending: false })
      if (error) throw error
      type Row = NutriAvaliacaoRow & { unidades: { nome: string } | null }
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        ...r,
        unidade_nome: r.unidades?.nome ?? '',
        usuario_nome: '',
      }))
    },
    staleTime: 1000 * 60 * 2,
  })
}

export interface NutriDetalhe {
  avaliacao: NutriAvaliacaoRow
  respostas: NutriResposta[]
  itens: NutriItem[]
  notasPorArea: NotaAreaNutri[]
  notaGeral: number | null
}

export function useNutriDetalhe(id: string) {
  return useQuery({
    queryKey: ['nutri-detalhe', id],
    queryFn: async (): Promise<NutriDetalhe> => {
      const [{ data: avData, error: avErr }, { data: rsData }] = await Promise.all([
        supabase
          .from('nutri_avaliacoes')
          .select('id, usuario_id, unidade_id, data_visita, competencia_mes, competencia_ano, lideres_presentes, obs_cozinha, obs_bar, obs_atendimento, relatorio_tecnico, criado_em, unidades(nome)')
          .eq('id', id)
          .single(),
        supabase
          .from('nutri_respostas')
          .select('id, avaliacao_id, item_id, valor, observacao')
          .eq('avaliacao_id', id),
      ])
      if (avErr) throw avErr

      type AvRow = NutriAvaliacaoRow & { unidades: { nome: string } | null }
      const av = avData as unknown as AvRow
      const rs = (rsData ?? []) as unknown as NutriResposta[]

      const itemIds = rs.map((r) => r.item_id)
      let itens: NutriItem[] = []
      if (itemIds.length > 0) {
        const { data: itData } = await supabase
          .from('nutri_itens')
          .select('id, area, descricao, ordem')
          .in('id', itemIds)
          .order('area')
          .order('ordem')
        itens = (itData ?? []) as unknown as NutriItem[]
      }

      const areas = ['Cozinha', 'Bar', 'Atendimento'] as const
      const itemAreaMap: Record<string, 'Cozinha' | 'Bar' | 'Atendimento'> = {}
      for (const it of itens) itemAreaMap[it.id] = it.area

      const notasPorArea: NotaAreaNutri[] = areas.map((area) => {
        const rsArea = rs.filter((r) => itemAreaMap[r.item_id] === area)
        const conforme = rsArea.filter((r) => r.valor === 'Conforme').length
        const nao_conforme = rsArea.filter((r) => r.valor === 'Nao_Conforme').length
        const nao_aplicavel = rsArea.filter((r) => r.valor === 'Nao_Aplicavel').length
        const total = conforme + nao_conforme
        return { area, nota: calcNota(conforme, total), conforme, nao_conforme, nao_aplicavel, total }
      })

      const notasValidas = notasPorArea.map((n) => n.nota).filter((n): n is number => n !== null)
      const notaGeral = avg(notasValidas)

      return {
        avaliacao: { ...av, unidade_nome: av.unidades?.nome ?? '', usuario_nome: '' },
        respostas: rs,
        itens,
        notasPorArea,
        notaGeral,
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

export function useInvalidateNutri() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['nutri-avaliacoes'] })
    qc.invalidateQueries({ queryKey: ['nutri-report'] })
  }
}
