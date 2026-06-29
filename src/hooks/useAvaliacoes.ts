import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Avaliacao, AvaliacaoResposta, Setor } from '../types'
import { calcularNotaSetor, calcularNotaUnidade } from '../utils/notas'

export interface AvaliacaoComNota extends Avaliacao {
  unidade_nome: string
  usuario_nome: string
  nota: number | null
}

export function useAvaliacoes() {
  return useQuery({
    queryKey: ['avaliacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select(`
          id, usuario_id, unidade_id, data_visita, competencia_mes, competencia_ano, criado_em,
          unidades(nome)
        `)
        .order('criado_em', { ascending: false })

      if (error) throw error

      type Row = Avaliacao & { unidades: { nome: string } | null }
      return ((data ?? []) as unknown as Row[]).map((a) => ({
        id: a.id,
        usuario_id: a.usuario_id,
        unidade_id: a.unidade_id,
        data_visita: a.data_visita,
        competencia_mes: a.competencia_mes,
        competencia_ano: a.competencia_ano,
        criado_em: a.criado_em,
        unidade_nome: a.unidades?.nome ?? '',
        usuario_nome: '',
        nota: null as number | null,
      })) as AvaliacaoComNota[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

export interface ItemDetalhe {
  item_id: string
  descricao: string
  secao: string | null
  ordem: number
  valor: number
  observacao: string | null
}

export interface DetalheAvaliacao {
  avaliacao: Avaliacao & { unidade_nome: string; usuario_nome: string }
  setores: Setor[]
  respostas: AvaliacaoResposta[]
  notasPorSetor: {
    setor: Setor
    nota: number | null
    itens: ItemDetalhe[]
  }[]
  notaGeral: number | null
}

export function useDetalheAvaliacao(id: string) {
  return useQuery({
    queryKey: ['avaliacao', id],
    queryFn: async (): Promise<DetalheAvaliacao> => {
      const [{ data: avData, error: avError }, { data: setoresData }, { data: respostasData }] = await Promise.all([
        supabase
          .from('avaliacoes')
          .select('id, usuario_id, unidade_id, data_visita, competencia_mes, competencia_ano, criado_em, unidades(nome)')
          .eq('id', id)
          .single(),
        supabase.from('setores').select('*').order('ordem'),
        supabase.from('avaliacao_respostas').select('*').eq('avaliacao_id', id),
      ])

      if (avError) throw avError

      type AvRow = Avaliacao & { unidades: { nome: string } | null }
      const av = avData as unknown as AvRow

      // Busca nome do usuário separadamente — join direto pode falhar se FK não estiver configurada
      let usuarioNome = ''
      if (av.usuario_id) {
        const { data: uData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', av.usuario_id)
          .maybeSingle()
        usuarioNome = (uData as { nome: string } | null)?.nome ?? ''
      }
      const ss = (setoresData ?? []) as unknown as Setor[]
      const rs = (respostasData ?? []) as unknown as AvaliacaoResposta[]

      const itemIds = rs.map((r) => r.item_id)
      const itensMap: Record<string, { descricao: string; secao: string | null; ordem: number }> = {}
      if (itemIds.length > 0) {
        const { data: itens } = await supabase
          .from('checklist_itens')
          .select('id, descricao, secao, ordem')
          .in('id', itemIds)
        ;((itens ?? []) as unknown as { id: string; descricao: string; secao: string | null; ordem: number }[]).forEach((i) => {
          itensMap[i.id] = { descricao: i.descricao, secao: i.secao, ordem: i.ordem }
        })
      }

      const notasPorSetor = ss
        .map((s) => {
          const rsSetor = rs.filter((r) => r.setor_id === s.id)
          if (rsSetor.length === 0) return null
          const itens: ItemDetalhe[] = rsSetor
            .map((r) => ({
              item_id: r.item_id,
              descricao: itensMap[r.item_id]?.descricao ?? r.item_id,
              secao: itensMap[r.item_id]?.secao ?? null,
              ordem: itensMap[r.item_id]?.ordem ?? 0,
              valor: r.valor,
              observacao: r.observacao,
            }))
            .sort((a, b) => a.ordem - b.ordem)
          return { setor: s, nota: calcularNotaSetor(rsSetor), itens }
        })
        .filter(Boolean) as DetalheAvaliacao['notasPorSetor']

      const notaGeral = calcularNotaUnidade(notasPorSetor.map((n) => n.nota))

      return {
        avaliacao: {
          id: av.id,
          usuario_id: av.usuario_id,
          unidade_id: av.unidade_id,
          data_visita: av.data_visita,
          competencia_mes: av.competencia_mes,
          competencia_ano: av.competencia_ano,
          criado_em: av.criado_em,
          unidade_nome: av.unidades?.nome ?? '',
          usuario_nome: usuarioNome,
        },
        setores: ss,
        respostas: rs,
        notasPorSetor,
        notaGeral,
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}
