import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import { corClasse, formatarNota, formatarMesAno } from '../utils/notas'
import type { NotaUnidade, Competencia } from '../types'
import type { NotaOperacao } from '../utils/sheetsParser'

const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

interface ItemCritico { descricao: string; setor: string; valor: 1 | 2 }

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

type Props = PropsOp | PropsNutri

async function buscarItensCriticosOp(
  unidadeId: string,
  competencia: Competencia,
  setoresFiltro: string[] | null,
): Promise<{ itens: ItemCritico[]; erro?: string }> {
  const { data: avs } = await supabase
    .from('avaliacoes')
    .select('id')
    .eq('unidade_id', unidadeId)
    .eq('competencia_mes', competencia.mes)
    .eq('competencia_ano', competencia.ano)

  const avIds = ((avs ?? []) as { id: string }[]).map((a) => a.id)
  if (avIds.length === 0) return { itens: [] }

  const { data: respostas } = await supabase
    .from('avaliacao_respostas')
    .select('item_id, setor_id, valor')
    .in('avaliacao_id', avIds)
    .lte('valor', 2)

  const rs = (respostas ?? []) as { item_id: string; setor_id: string; valor: number }[]
  if (rs.length === 0) return { itens: [] }

  const itemIds = [...new Set(rs.map((r) => r.item_id))]
  const setorIds = [...new Set(rs.map((r) => r.setor_id))]

  const [{ data: itensData }, { data: setoresData }] = await Promise.all([
    supabase.from('checklist_itens').select('id, descricao').in('id', itemIds),
    supabase.from('setores').select('id, rotulo, nome').in('id', setorIds),
  ])

  const itemMap: Record<string, string> = {}
  for (const i of (itensData ?? []) as { id: string; descricao: string }[]) itemMap[i.id] = i.descricao

  const setorMap: Record<string, { rotulo: string; nome: string }> = {}
  for (const s of (setoresData ?? []) as { id: string; rotulo: string; nome: string }[]) {
    setorMap[s.id] = { rotulo: s.rotulo, nome: s.nome }
  }

  const itens: ItemCritico[] = rs
    .filter((r) => {
      const s = setorMap[r.setor_id]
      return itemMap[r.item_id] && s && SETORES_OP.includes(s.nome) && (setoresFiltro === null || setoresFiltro.includes(s.nome))
    })
    .map((r) => ({
      descricao: itemMap[r.item_id],
      setor: setorMap[r.setor_id].rotulo,
      valor: r.valor as 1 | 2,
    }))

  return { itens }
}

export function UnidadeSugestoesModal(props: Props) {
  const { competencia, onClose, setoresFiltro = null } = props
  const [sugestoes, setSugestoes] = useState<string | null>(null)
  const [itensCriticos, setItensCriticos] = useState<ItemCritico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const nome = props.tipo === 'operacional' ? props.unidade.unidade_nome : props.row.unidade
  const scores =
    props.tipo === 'operacional'
      ? props.unidade.notas_setores
          .filter((ns) => SETORES_OP.includes(ns.setor_nome) && (setoresFiltro === null || setoresFiltro.includes(ns.setor_nome)))
          .map((ns) => ({ nome: ns.setor_rotulo, nota: ns.nota }))
      : (['Cozinha', 'Bar', 'Atendimento'] as const)
          .filter((a) => setoresFiltro === null || setoresFiltro.includes(a))
          .map((a) => ({ nome: a, nota: props.row[a] }))

  useEffect(() => {
    async function run() {
      try {
        let itens: ItemCritico[] = []

        if (props.tipo === 'operacional') {
          const res = await buscarItensCriticosOp(props.unidade.unidade_id, competencia, setoresFiltro)
          itens = res.itens
          setItensCriticos(itens)
        }

        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unidade: nome,
            competencia: formatarMesAno(competencia.mes, competencia.ano),
            tipo: props.tipo,
            setores: scores,
            itensCriticos: itens,
          }),
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

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-dvh w-full max-w-md bg-white z-50 overflow-y-auto shadow-2xl animate-slide-in">
        {/* Header — sticky no topo enquanto o conteúdo rola */}
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{nome}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {props.tipo === 'operacional' ? 'Operacional' : 'Seg. Alimentar & 5S'} · {formatarMesAno(competencia.mes, competencia.ano)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scores */}
        <div className={`px-5 py-3 border-b border-gray-100 grid gap-2 ${scores.length <= 1 ? 'grid-cols-1' : scores.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {scores.map((s) => (
            <div key={s.nome} className="text-center bg-gray-50 rounded-xl py-2.5 px-1">
              <p className="text-xs text-gray-400 mb-0.5">{s.nome}</p>
              <span className={`text-base font-bold ${corClasse(s.nota)}`}>{formatarNota(s.nota)}</span>
            </div>
          ))}
        </div>

        {/* Itens críticos (operacional) */}
        {!loading && props.tipo === 'operacional' && itensCriticos.length > 0 && (
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Sugestões de melhoria
          </p>
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
