import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import { corClasse, formatarNota, formatarMesAno } from '../utils/notas'
import type { NotaUnidade, NotaSetor, Competencia } from '../types'
import type { NotaOperacao } from '../utils/sheetsParser'

const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

interface ItemCritico { descricao: string; setor: string; valor: 1 | 2 }

function avgNulls(arr: (number | null)[]): number | null {
  const v = arr.filter((n): n is number => n !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

interface BaseProps {
  competencia: Competencia
  onClose: () => void
  setoresFiltro?: string[] | null
}

interface PropsOp extends BaseProps {
  tipo: 'operacional'
  unidade: NotaUnidade
}

interface PropsNutri extends BaseProps {
  tipo: 'nutri'
  row: NotaOperacao
}

interface PropsCombinado extends BaseProps {
  tipo: 'combinado'
  unidade: NotaUnidade
  notaNutri: number | null
  checkAbr: number
  checkFech: number
  checkEsperado: number
  temChecklist: boolean
}

type Props = PropsOp | PropsNutri | PropsCombinado

async function buscarItensCriticosOp(
  unidadeId: string,
  competencia: Competencia,
  setoresFiltro: string[] | null,
): Promise<ItemCritico[]> {
  const { data: avs } = await supabase
    .from('avaliacoes')
    .select('id')
    .eq('unidade_id', unidadeId)
    .eq('competencia_mes', competencia.mes)
    .eq('competencia_ano', competencia.ano)

  const avIds = ((avs ?? []) as { id: string }[]).map((a) => a.id)
  if (avIds.length === 0) return []

  const { data: respostas } = await supabase
    .from('avaliacao_respostas')
    .select('item_id, setor_id, valor')
    .in('avaliacao_id', avIds)
    .lte('valor', 2)

  const rs = (respostas ?? []) as { item_id: string; setor_id: string; valor: number }[]
  if (rs.length === 0) return []

  const itemIds = [...new Set(rs.map((r) => r.item_id))]
  const setorIds = [...new Set(rs.map((r) => r.setor_id))]

  const [{ data: itensData }, { data: setoresData }] = await Promise.all([
    supabase.from('checklist_itens').select('id, descricao').in('id', itemIds),
    supabase.from('setores').select('id, rotulo, nome').in('id', setorIds),
  ])

  const itemMap: Record<string, string> = {}
  for (const i of (itensData ?? []) as { id: string; descricao: string }[]) itemMap[i.id] = i.descricao

  const setorMap: Record<string, { rotulo: string; nome: string }> = {}
  for (const s of (setoresData ?? []) as { id: string; rotulo: string; nome: string }[])
    setorMap[s.id] = { rotulo: s.rotulo, nome: s.nome }

  return rs
    .filter((r) => {
      const s = setorMap[r.setor_id]
      return itemMap[r.item_id] && s && SETORES_OP.includes(s.nome) && (setoresFiltro === null || setoresFiltro.includes(s.nome))
    })
    .map((r) => ({
      descricao: itemMap[r.item_id],
      setor: setorMap[r.setor_id].rotulo,
      valor: r.valor as 1 | 2,
    }))
}

export function UnidadeSugestoesModal(props: Props) {
  const { competencia, onClose, setoresFiltro = null } = props
  const [sugestoes, setSugestoes] = useState<string | null>(null)
  const [itensCriticos, setItensCriticos] = useState<ItemCritico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const nome = props.tipo === 'nutri' ? props.row.unidade : props.unidade.unidade_nome

  const tipoLabel =
    props.tipo === 'operacional' ? 'Operacional'
    : props.tipo === 'nutri' ? 'Seg. Alimentar & 5S'
    : 'Análise Completa'

  // Scores for operacional / nutri (not used for combinado)
  const scores =
    props.tipo === 'operacional'
      ? props.unidade.notas_setores
          .filter((ns) => SETORES_OP.includes(ns.setor_nome) && (setoresFiltro === null || setoresFiltro.includes(ns.setor_nome)))
          .map((ns) => ({ nome: ns.setor_rotulo, nota: ns.nota }))
      : props.tipo === 'nutri'
      ? (['Cozinha', 'Bar', 'Atendimento'] as const)
          .filter((a) => setoresFiltro === null || setoresFiltro.includes(a))
          .map((a) => ({ nome: a, nota: props.row[a] }))
      : []

  // Operacional sectors for combinado view
  const combinadoSetoresOp: NotaSetor[] =
    props.tipo === 'combinado'
      ? props.unidade.notas_setores.filter(
          (ns) => SETORES_OP.includes(ns.setor_nome) && (setoresFiltro === null || setoresFiltro.includes(ns.setor_nome)),
        )
      : []
  const combinadoNotaOp = avgNulls(combinadoSetoresOp.map((ns) => ns.nota))

  useEffect(() => {
    async function run() {
      try {
        let itens: ItemCritico[] = []

        if (props.tipo === 'operacional' || props.tipo === 'combinado') {
          itens = await buscarItensCriticosOp(props.unidade.unidade_id, competencia, setoresFiltro)
          setItensCriticos(itens)
        }

        let postBody: Record<string, unknown>

        if (props.tipo === 'combinado') {
          postBody = {
            unidade: nome,
            competencia: formatarMesAno(competencia.mes, competencia.ano),
            tipo: 'combinado',
            operacional: combinadoSetoresOp.map((ns) => ({ nome: ns.setor_rotulo, nota: ns.nota })),
            itensCriticos: itens,
            nutri: props.notaNutri,
            checklist: props.temChecklist
              ? { abertura: props.checkAbr, fechamento: props.checkFech, esperado: props.checkEsperado }
              : null,
          }
        } else {
          postBody = {
            unidade: nome,
            competencia: formatarMesAno(competencia.mes, competencia.ano),
            tipo: props.tipo,
            setores: scores,
            itensCriticos: itens,
          }
        }

        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data?.error ?? `Erro ${response.status}`)
        setSugestoes(data.sugestoes ?? data.error)
      } catch (err: unknown) {
        setErro((err instanceof Error ? err.message : null) ?? 'Não foi possível gerar sugestões. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function corCheck(count: number, esperado: number) {
    if (count >= esperado) return 'text-green-600'
    if (count > 0) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-dvh w-full max-w-md bg-white z-50 overflow-y-auto shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{nome}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {tipoLabel} · {formatarMesAno(competencia.mes, competencia.ano)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scores — operacional / nutri */}
        {props.tipo !== 'combinado' && (
          <div
            className={`px-5 py-3 border-b border-gray-100 grid gap-2 ${
              scores.length <= 1 ? 'grid-cols-1' : scores.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {scores.map((s) => (
              <div key={s.nome} className="text-center bg-gray-50 rounded-xl py-2.5 px-1">
                <p className="text-xs text-gray-400 mb-0.5">{s.nome}</p>
                <span className={`text-base font-bold ${corClasse(s.nota)}`}>{formatarNota(s.nota)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Scores — combinado */}
        {props.tipo === 'combinado' && (
          <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-3 gap-2">
            {/* Operacional */}
            <div className="text-center bg-gray-50 rounded-xl py-2.5 px-1">
              <p className="text-[10px] text-gray-400 mb-0.5">Operacional</p>
              <span className={`text-sm font-bold ${corClasse(combinadoNotaOp)}`}>
                {formatarNota(combinadoNotaOp)}
              </span>
              {combinadoSetoresOp.length > 1 && (
                <div className="mt-1 space-y-0.5">
                  {combinadoSetoresOp.map((ns) => (
                    <div key={ns.setor_id} className="text-center">
                      <span className="text-[9px] text-gray-400">{ns.setor_rotulo} </span>
                      <span className={`text-[9px] font-semibold ${corClasse(ns.nota)}`}>{formatarNota(ns.nota)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Seg. Alimentar */}
            <div className="text-center bg-gray-50 rounded-xl py-2.5 px-1">
              <p className="text-[10px] text-gray-400 mb-0.5">Seg. Alim.</p>
              <span className={`text-sm font-bold ${corClasse(props.notaNutri)}`}>
                {formatarNota(props.notaNutri)}
              </span>
            </div>
            {/* Checklist */}
            <div className="text-center bg-gray-50 rounded-xl py-2.5 px-1">
              <p className="text-[10px] text-gray-400 mb-0.5">Checklist</p>
              {props.temChecklist ? (
                <div className="text-xs font-semibold space-y-0.5">
                  <div className={corCheck(props.checkAbr, props.checkEsperado)}>
                    A {props.checkAbr}/{props.checkEsperado}
                  </div>
                  <div className={corCheck(props.checkFech, props.checkEsperado)}>
                    F {props.checkFech}/{props.checkEsperado}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
            </div>
          </div>
        )}

        {/* Itens críticos */}
        {!loading && (props.tipo === 'operacional' || props.tipo === 'combinado') && itensCriticos.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {itensCriticos.length} pontos críticos identificados
            </p>
            <div className="space-y-1">
              {itensCriticos.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                      item.valor === 1 ? 'bg-red-500' : 'bg-orange-400'
                    }`}
                  />
                  <span className="text-gray-600">
                    <span className="font-medium text-gray-700">{item.setor}:</span> {item.descricao}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sugestões */}
        <div className="px-5 py-4 pb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sugestões de melhoria</p>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <LoadingSpinner text="Analisando e gerando sugestões..." />
            </div>
          ) : erro ? (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{erro}</div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sugestoes}</p>
          )}
        </div>
      </div>
    </>
  )
}
