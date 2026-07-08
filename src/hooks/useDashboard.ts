import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Competencia, NotaUnidade, NotaSetor, Setor } from '../types'
import {
  calcularNotaSetor,
  calcularNotaUnidade,
  calcularNotaRede,
  competenciaAnterior,
} from '../utils/notas'

interface UnidadeRow { id: string; nome: string }
interface RespostaRow { setor_id: string; valor: number; avaliacao_id: string }
interface AvaliacaoRow { id: string; unidade_id: string }

async function fetchDashboardData(c: Competencia, unidadeIds?: string[] | null) {
  // Array vazio = usuário restrito sem unidades → não mostrar nada
  if (unidadeIds !== null && unidadeIds !== undefined && unidadeIds.length === 0) {
    return { notasUnidades: [], notaRede: null, visitCounts: {}, sectorVisitCounts: {} }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unidadesQ = (supabase as any).from('unidades').select('id, nome').eq('ativo', true).order('nome')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let avaliacoesQ = (supabase as any)
    .from('avaliacoes')
    .select('id, unidade_id')
    .eq('competencia_mes', c.mes)
    .eq('competencia_ano', c.ano)
  if (unidadeIds && unidadeIds.length > 0) {
    unidadesQ   = unidadesQ.in('id', unidadeIds)
    avaliacoesQ = avaliacoesQ.in('unidade_id', unidadeIds)
  }
  const [{ data: unidades }, { data: setores }, { data: avaliacoes }] = await Promise.all([
    unidadesQ,
    supabase.from('setores').select('id, nome, rotulo, ordem').order('ordem'),
    avaliacoesQ,
  ])

  if (!unidades || !setores || !avaliacoes) return { notasUnidades: [], notaRede: null }

  const us = unidades as unknown as UnidadeRow[]
  const ss = setores as unknown as Setor[]
  const avs = avaliacoes as unknown as AvaliacaoRow[]

  const avaliacaoIds = avs.map((a) => a.id)

  let respostas: RespostaRow[] = []
  if (avaliacaoIds.length > 0) {
    const { data } = await supabase
      .from('avaliacao_respostas')
      .select('setor_id, valor, avaliacao_id')
      .in('avaliacao_id', avaliacaoIds)
    respostas = (data as unknown as RespostaRow[]) ?? []
  }

  const notasUnidades: NotaUnidade[] = us.map((u) => {
    const avsUnidade = avs.filter((a) => a.unidade_id === u.id)
    const idsUnidade = new Set(avsUnidade.map((a) => a.id))
    const respostasUnidade = respostas.filter((r) => idsUnidade.has(r.avaliacao_id))

    const notas_setores: NotaSetor[] = ss.map((s) => {
      const rsSetor = respostasUnidade.filter((r) => r.setor_id === s.id)
      return {
        setor_id: s.id,
        setor_rotulo: s.rotulo,
        setor_nome: s.nome,
        nota: calcularNotaSetor(rsSetor),
      }
    })

    return {
      unidade_id: u.id,
      unidade_nome: u.nome,
      nota: calcularNotaUnidade(notas_setores.map((ns) => ns.nota)),
      notas_setores,
    }
  })

  const visitCounts: Record<string, number> = {}
  for (const u of us) {
    visitCounts[u.id] = avs.filter((a) => a.unidade_id === u.id).length
  }

  // Count per unit per sector: how many evaluations have responses for each sector.
  const sectorVisitCounts: Record<string, Record<string, number>> = {}
  for (const u of us) {
    sectorVisitCounts[u.id] = {}
    const avsForUnit = avs.filter((a) => a.unidade_id === u.id)
    for (const s of ss) {
      const avIdsWithSetor = new Set(
        respostas.filter((r) => r.setor_id === s.id).map((r) => r.avaliacao_id)
      )
      sectorVisitCounts[u.id][s.nome] = avsForUnit.filter((a) => avIdsWithSetor.has(a.id)).length
    }
  }

  const notaRede = calcularNotaRede(notasUnidades.map((nu) => nu.nota))
  return { notasUnidades, notaRede, visitCounts, sectorVisitCounts }
}

export function useDashboard(competencia: Competencia, unidadeIds?: string[] | null) {
  const ant = competenciaAnterior(competencia)

  const atual = useQuery({
    queryKey: ['dashboard', competencia.mes, competencia.ano, unidadeIds],
    queryFn: () => fetchDashboardData(competencia, unidadeIds),
    staleTime: 1000 * 60 * 5,
  })

  const anterior = useQuery({
    queryKey: ['dashboard', ant.mes, ant.ano, unidadeIds],
    queryFn: () => fetchDashboardData(ant, unidadeIds),
    staleTime: 1000 * 60 * 10,
  })

  const variacao =
    atual.data?.notaRede != null && anterior.data?.notaRede != null
      ? atual.data.notaRede - anterior.data.notaRede
      : null

  return {
    notasUnidades: atual.data?.notasUnidades ?? [],
    notaRede: atual.data?.notaRede ?? null,
    visitCounts: atual.data?.visitCounts ?? {},
    sectorVisitCounts: atual.data?.sectorVisitCounts ?? {},
    variacao,
    loading: atual.isLoading,
    error: atual.error,
  }
}
