import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useDashboard } from '../../hooks/useDashboard'
import { useSegAlimentar } from '../../hooks/useSegAlimentar'
import { useAuth } from '../../context/AuthContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { corClasse, formatarNota, formatarCompetencia, competenciaAtual } from '../../utils/notas'
import { DB_TO_SHEET, metaOperacional, metaNutri } from '../../utils/unidades'
import { useCompetenciasDisponiveis } from '../../hooks/useCompetenciasDisponiveis'
import type { Competencia } from '../../types'


function useNutriCounts(competencia: Competencia) {
  return useQuery({
    queryKey: ['nutri-counts', competencia.mes, competencia.ano],
    queryFn: async () => {
      const { data } = await supabase
        .from('nutri_avaliacoes').select('unidade_id')
        .eq('competencia_mes', competencia.mes).eq('competencia_ano', competencia.ano)
      const counts: Record<string, number> = {}
      for (const av of (data ?? []) as { unidade_id: string }[])
        counts[av.unidade_id] = (counts[av.unidade_id] ?? 0) + 1
      return counts
    },
    staleTime: 1000 * 60 * 2,
  })
}

function useHistoricoOp(competencia: Competencia, unidadeIds: string[] | null) {
  return useQuery({
    queryKey: ['historico-av', competencia.mes, competencia.ano, unidadeIds],
    queryFn: async () => {
      let q = (supabase as any)
        .from('avaliacoes')
        .select('id, data_visita, unidade_id, unidades(nome)')
        .eq('competencia_mes', competencia.mes)
        .eq('competencia_ano', competencia.ano)
        .order('data_visita', { ascending: false })
      if (unidadeIds) q = q.in('unidade_id', unidadeIds)
      const { data } = await q
      return (data ?? []) as { id: string; data_visita: string; unidade_id: string; unidades: { nome: string } }[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

function useHistoricoNutri(competencia: Competencia, unidadeIds: string[] | null) {
  return useQuery({
    queryKey: ['historico-nutri', competencia.mes, competencia.ano, unidadeIds],
    queryFn: async () => {
      let q = (supabase as any)
        .from('nutri_avaliacoes')
        .select('id, data_visita, unidade_id, unidades(nome)')
        .eq('competencia_mes', competencia.mes)
        .eq('competencia_ano', competencia.ano)
        .order('data_visita', { ascending: false })
      if (unidadeIds) q = q.in('unidade_id', unidadeIds)
      const { data } = await q
      return (data ?? []) as { id: string; data_visita: string; unidade_id: string; unidades: { nome: string } }[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

function badgeCls(feitas: number, meta: number) {
  if (meta === 0)     return 'bg-gray-100 text-gray-400 border-gray-200'
  if (feitas >= meta) return 'bg-green-100 text-green-700 border-green-200'
  if (feitas > 0)     return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-red-100 text-red-600 border-red-200'
}

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${aberto ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Histórico operacional — lista com link para detalhe completo ───────────────
function HistoricoOp({ competencia, unidadeIds }: { competencia: Competencia; unidadeIds: string[] | null }) {
  const { data: avaliacoes, isLoading } = useHistoricoOp(competencia, unidadeIds)

  if (isLoading) return <div className="p-4"><LoadingSpinner text="Carregando..." /></div>
  if (!avaliacoes || avaliacoes.length === 0)
    return <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma avaliação operacional nesta competência.</p>

  return (
    <div className="divide-y divide-gray-100">
      {avaliacoes.map((av) => {
        const dataFmt = av.data_visita.split('-').reverse().join('/')
        return (
          <Link
            key={av.id}
            to={`/avaliacoes/${av.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-400 shrink-0 font-medium">{dataFmt}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{av.unidades?.nome ?? '—'}</span>
            </div>
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )
      })}
    </div>
  )
}


// ── Histórico Nutri DB ────────────────────────────────────────────────────────
function HistoricoNutriDB({ competencia, unidadeIds }: { competencia: Competencia; unidadeIds: string[] | null }) {
  const { data: avaliacoes, isLoading } = useHistoricoNutri(competencia, unidadeIds)

  if (isLoading) return <div className="p-4"><LoadingSpinner text="Carregando..." /></div>
  if (!avaliacoes || avaliacoes.length === 0)
    return <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma avaliação de seg. alimentar nesta competência.</p>

  return (
    <div className="divide-y divide-gray-100">
      {avaliacoes.map((av) => {
        const dataFmt = av.data_visita.split('-').reverse().join('/')
        return (
          <Link
            key={av.id}
            to={`/seg-alimentar/${av.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-400 shrink-0 font-medium">{dataFmt}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{av.unidades?.nome ?? '—'}</span>
            </div>
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )
      })}
    </div>
  )
}

// ── Histórico combinado com abas ───────────────────────────────────────────────
function HistoricoAvaliacoes({ competencia, unidadeIds }: { competencia: Competencia; unidadeIds: string[] | null }) {
  const [aba, setAba] = useState<'op' | 'nutri'>('op')

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700">Histórico de avaliações</h3>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setAba('op')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            aba === 'op' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Operacional
        </button>
        <button
          onClick={() => setAba('nutri')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            aba === 'nutri' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Seg. Alimentar & 5S
        </button>
      </div>

      {aba === 'op'
        ? <HistoricoOp competencia={competencia} unidadeIds={unidadeIds} />
        : <HistoricoNutriDB competencia={competencia} unidadeIds={unidadeIds} />
      }
    </div>
  )
}

// ── Seção colapsável ──────────────────────────────────────────────────────────
function SecaoColapsavel({ titulo, meta, children }: { titulo: string; meta: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between gap-2 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-700">{titulo}</h3>
          <span className="text-xs text-gray-400">{meta}</span>
        </div>
        <Chevron aberto={aberto} />
      </button>
      {aberto && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  )
}

// ── Botões nova avaliação ─────────────────────────────────────────────────────
function BotoesNovaAvaliacao({ setoresPermitidos, podeNutri }: { setoresPermitidos: string[]; podeNutri: boolean }) {
  const navigate = useNavigate()
  const temOp = setoresPermitidos.length > 0
  if (!temOp && !podeNutri) return null
  const labelOp = setoresPermitidos.length === 1 ? setoresPermitidos[0] : 'Operacional'
  return (
    <div className="flex items-center gap-2">
      {temOp && (
        <button
          onClick={() => navigate('/avaliacoes/nova')}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova · {labelOp}
        </button>
      )}
      {podeNutri && (
        <button
          onClick={() => navigate('/seg-alimentar/nova')}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova · Seg. Alimentar
        </button>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export function Avaliacoes() {
  const { perfil } = useAuth()
  const { data: opcoes = [] } = useCompetenciasDisponiveis()
  const [competencia, setCompetencia] = useState<Competencia>(competenciaAtual)
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!syncedRef.current && opcoes.length > 0) {
      syncedRef.current = true
      setCompetencia(opcoes[0])
    }
  }, [opcoes])
  const valor = `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`
  const setoresPermitidos: string[] = perfil?.setores_avaliacao ?? []
  const podeNutri: boolean = perfil?.pode_nutri ?? false

  const { notasUnidades, visitCounts, sectorVisitCounts, loading: loadOp } = useDashboard(competencia)
  const { data: nutriCounts = {} } = useNutriCounts(competencia)
  const { rows: sheetsRows } = useSegAlimentar(competencia)

  // Filtro por unidade para usuários com role='leitura'
  const isLeitura = perfil?.role === 'leitura'
  const unidadeIdsPermitidas: string[] | null = isLeitura ? (perfil?.unidades_ids ?? []) : null

  const notasVisiveis = unidadeIdsPermitidas
    ? notasUnidades.filter((nu) => unidadeIdsPermitidas.includes(nu.unidade_id))
    : notasUnidades

  const permittedSheetKeys: string[] | null = unidadeIdsPermitidas
    ? notasVisiveis.flatMap((nu) => { const k = DB_TO_SHEET[nu.unidade_nome]; return k ? [k] : [] })
    : null

  // Sheet names can be raw CSV values (e.g. "INDE01 – Itapema") while keys are INDE codes.
  // Use startsWith to safely match prefix without false positives from bare .includes().
  const matchSheet = (name: string, keys: string[]) =>
    keys.some((k) => name === k || name.startsWith(k + ' ') || name.startsWith(k + '–') || name.startsWith(k + ' –'))

  const sheetsRowsVisiveis = permittedSheetKeys
    ? sheetsRows.filter((r) => matchSheet(r.unidade, permittedSheetKeys))
    : sheetsRows

  const sheetVisitas: Record<string, number> = {}
  for (const row of sheetsRowsVisiveis) {
    // indexa pelo nome de exibição (cobre Joinville mesclado e nomes sem código)
    sheetVisitas[row.unidade] = row.visitas
    // também indexa pelo código INDE quando presente no nome
    const m = row.unidade.match(/INDE\d+/i)
    if (m) sheetVisitas[m[0].toUpperCase()] = row.visitas
  }

  const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Avaliações</h2>
        <BotoesNovaAvaliacao setoresPermitidos={setoresPermitidos} podeNutri={podeNutri} />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 whitespace-nowrap">Competência</label>
        <select
          value={valor}
          onChange={(e) => {
            const [ano, mes] = e.target.value.split('-').map(Number)
            setCompetencia({ mes, ano })
          }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {opcoes.map((o) => {
            const v = `${o.ano}-${String(o.mes).padStart(2, '0')}`
            return <option key={v} value={v}>{formatarCompetencia(o)}</option>
          })}
        </select>
      </div>

      {loadOp ? <LoadingSpinner text="Carregando visitas..." /> : (
        <>
          {(perfil?.role === 'rede' || setoresPermitidos.length > 0) && (
          <SecaoColapsavel titulo="Operacional" meta="meta: 2/mês · NV: 1">
            {notasVisiveis.map((nu) => {
              const meta = metaOperacional(nu.unidade_nome)
              const counts = sectorVisitCounts[nu.unidade_id] ?? {}
              const feitas = setoresPermitidos.length > 0
                ? Math.min(...setoresPermitidos.map((s) => counts[s] ?? 0))
                : (visitCounts[nu.unidade_id] ?? 0)
              const setores = nu.notas_setores.filter((ns) => SETORES_OP.includes(ns.setor_nome))
              return (
                <div key={nu.unidade_id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{nu.unidade_nome}</span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badgeCls(feitas, meta)}`}>
                      {feitas}/{meta}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {setores.map((ns) => (
                      <div key={ns.setor_id} className="text-center bg-gray-50 rounded-lg py-1.5 px-1">
                        <p className="text-xs text-gray-400 mb-0.5">{ns.setor_rotulo}</p>
                        <span className={`text-sm font-bold ${corClasse(ns.nota)}`}>{formatarNota(ns.nota)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </SecaoColapsavel>
          )}

          {(perfil?.role === 'rede' || podeNutri) && (
          <SecaoColapsavel titulo="Seg. Alimentar & 5S" meta="meta: 4/mês · Nova Veneza: 1">
            {notasVisiveis.map((nu) => {
              const meta = metaNutri(nu.unidade_nome)
              const dbFeitas = nutriCounts[nu.unidade_id] ?? 0
              const sheetKey = DB_TO_SHEET[nu.unidade_nome]
              const sheetFeitas = sheetKey ? (sheetVisitas[sheetKey] ?? 0) : 0
              const feitas = dbFeitas > 0 ? dbFeitas : sheetFeitas
              return (
                <div key={nu.unidade_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-800 truncate">{nu.unidade_nome}</span>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badgeCls(feitas, meta)}`}>
                    {feitas}/{meta}
                  </span>
                </div>
              )
            })}
          </SecaoColapsavel>
          )}

          <HistoricoAvaliacoes competencia={competencia} unidadeIds={unidadeIdsPermitidas} />
        </>
      )}
    </div>
  )
}
