import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useDashboard } from '../../hooks/useDashboard'
import { useSegAlimentar } from '../../hooks/useSegAlimentar'
import { useAuth } from '../../context/AuthContext'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { corClasse, formatarNota, formatarCompetencia, competenciaAtual } from '../../utils/notas'
import { DB_TO_SHEET, metaOperacional, metaNutri, metaSetorOp } from '../../utils/unidades'
import { useCompetenciasDisponiveis } from '../../hooks/useCompetenciasDisponiveis'
import type { Competencia } from '../../types'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'
const JULIA_EMAIL = 'nutrijuliamafra@gmail.com'

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

type AvaliacaoHistorico = {
  id: string
  data_visita: string
  unidade_id: string
  unidades: { nome: string }
  avaliacao_respostas: { setor_id: string; setores: { nome: string; rotulo: string } | null }[]
}

function setoresDaAvaliacao(av: AvaliacaoHistorico): { nome: string; rotulo: string }[] {
  const seen = new Set<string>()
  const result: { nome: string; rotulo: string }[] = []
  for (const r of av.avaliacao_respostas) {
    const s = r.setores
    if (s && !seen.has(s.nome)) { seen.add(s.nome); result.push(s) }
  }
  return result
}

function useHistoricoOp(competencia: Competencia, unidadeIds: string[] | null, setoresPermitidos: string[] | null) {
  return useQuery({
    queryKey: ['historico-av', competencia.mes, competencia.ano, unidadeIds, setoresPermitidos],
    queryFn: async () => {
      let q = (supabase as any)
        .from('avaliacoes')
        .select('id, data_visita, unidade_id, unidades(nome), avaliacao_respostas(setor_id, setores(nome, rotulo))')
        .eq('competencia_mes', competencia.mes)
        .eq('competencia_ano', competencia.ano)
        .order('data_visita', { ascending: false })
      if (unidadeIds) q = q.in('unidade_id', unidadeIds)
      const { data } = await q
      const all = (data ?? []) as AvaliacaoHistorico[]
      if (!setoresPermitidos) return all
      return all.filter((av) =>
        setoresDaAvaliacao(av).some((s) => setoresPermitidos.includes(s.nome))
      )
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
        .select('id, data_visita, unidade_id, unidades(nome), relatorio_pdf_url')
        .eq('competencia_mes', competencia.mes)
        .eq('competencia_ano', competencia.ano)
        .order('data_visita', { ascending: false })
      if (unidadeIds) q = q.in('unidade_id', unidadeIds)
      const { data } = await q
      return (data ?? []) as { id: string; data_visita: string; unidade_id: string; unidades: { nome: string }; relatorio_pdf_url: string | null }[]
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
function HistoricoOp({ competencia, unidadeIds, setoresPermitidos }: { competencia: Competencia; unidadeIds: string[] | null; setoresPermitidos: string[] | null }) {
  const { user, perfil } = useAuth()
  const queryClient = useQueryClient()
  const { data: avaliacoes, isLoading } = useHistoricoOp(competencia, unidadeIds, setoresPermitidos)
  const [deletingAv, setDeletingAv] = useState<string | null>(null)
  const canDelete = user?.email === ADMIN_EMAIL || perfil?.ver_tudo === true

  async function handleDelete(avaliacaoId: string) {
    if (!confirm('Apagar este lançamento? Esta ação não pode ser desfeita.')) return
    setDeletingAv(avaliacaoId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacaoId}&tipo=operacional`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { alert('Erro ao apagar lançamento.'); return }
      queryClient.invalidateQueries({ queryKey: ['historico-av'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      setDeletingAv(null)
    }
  }

  if (isLoading) return <div className="p-4"><LoadingSpinner text="Carregando..." /></div>
  if (!avaliacoes || avaliacoes.length === 0)
    return <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma avaliação operacional nesta competência.</p>

  return (
    <div className="divide-y divide-gray-100">
      {avaliacoes.map((av) => {
        const dataFmt = av.data_visita.split('-').reverse().join('/')
        const setores = setoresDaAvaliacao(av)
        return (
          <div key={av.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Link to={`/avaliacoes/${av.id}`} className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xs text-gray-400 shrink-0 font-medium">{dataFmt}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{av.unidades?.nome ?? '—'}</span>
              {setores.length > 0 && (
                <span className="shrink-0 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                  {setores.map((s) => s.rotulo).join(' · ')}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {canDelete && (
                <button
                  disabled={deletingAv === av.id}
                  onClick={() => handleDelete(av.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2 py-1 rounded-lg transition-colors font-medium disabled:opacity-50"
                  title="Apagar lançamento"
                >
                  {deletingAv === av.id ? '…' : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
              <Link to={`/avaliacoes/${av.id}`} className="shrink-0">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ── Histórico Nutri DB ────────────────────────────────────────────────────────
function HistoricoNutriDB({ competencia, unidadeIds }: { competencia: Competencia; unidadeIds: string[] | null }) {
  const { user } = useAuth()
  const isJulia = user?.email === JULIA_EMAIL || user?.email === ADMIN_EMAIL
  const queryClient = useQueryClient()
  const { data: avaliacoes, isLoading } = useHistoricoNutri(competencia, unidadeIds)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingAv, setDeletingAv] = useState<string | null>(null)

  async function handleDeleteAvaliacao(avaliacaoId: string) {
    if (!confirm('Apagar este lançamento inteiro? Esta ação não pode ser desfeita.')) return
    setDeletingAv(avaliacaoId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacaoId}&tipo=nutri`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { alert('Erro ao apagar lançamento.'); return }
      queryClient.invalidateQueries({ queryKey: ['historico-nutri'] })
    } finally {
      setDeletingAv(null)
    }
  }

  async function handleDelete(avaliacaoId: string) {
    if (!confirm('Apagar o PDF desta avaliação?')) return
    setDeleting(avaliacaoId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const res = await fetch('/api/nutri-pdf', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avaliacaoId }),
      })
      if (!res.ok) { alert('Erro ao apagar PDF.'); return }
      queryClient.invalidateQueries({ queryKey: ['historico-nutri'] })
    } finally {
      setDeleting(null)
    }
  }

  async function handleUpload(avaliacaoId: string, file: File) {
    setUploading(avaliacaoId)
    try {
      const path = `${avaliacaoId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('nutri-relatorios')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (uploadError) { alert('Erro ao enviar arquivo: ' + uploadError.message); return }

      const { data: { publicUrl } } = supabase.storage.from('nutri-relatorios').getPublicUrl(path)

      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const res = await fetch('/api/nutri-pdf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avaliacaoId, pdfUrl: publicUrl }),
      })
      if (!res.ok) { alert('Erro ao salvar referência do PDF.'); return }

      queryClient.invalidateQueries({ queryKey: ['historico-nutri'] })
    } finally {
      setUploading(null)
    }
  }

  if (isLoading) return <div className="p-4"><LoadingSpinner text="Carregando..." /></div>
  if (!avaliacoes || avaliacoes.length === 0)
    return <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhuma avaliação de seg. alimentar nesta competência.</p>

  return (
    <div className="divide-y divide-gray-100">
      {avaliacoes.map((av) => {
        const dataFmt = av.data_visita.split('-').reverse().join('/')
        const isUploading = uploading === av.id
        return (
          <div key={av.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Link to={`/seg-alimentar/${av.id}`} className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xs text-gray-400 shrink-0 font-medium">{dataFmt}</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{av.unidades?.nome ?? '—'}</span>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              {av.relatorio_pdf_url && (
                <a
                  href={av.relatorio_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors font-medium"
                  title="Ver relatório PDF"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  PDF
                </a>
              )}

              {isJulia && (
                <label
                  className={`flex items-center gap-1 text-xs cursor-pointer px-2 py-1 rounded-lg border transition-colors font-medium ${
                    isUploading
                      ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                      : 'text-brand-600 bg-brand-50 hover:bg-brand-100 border-brand-200'
                  }`}
                  title={av.relatorio_pdf_url ? 'Substituir PDF' : 'Subir PDF'}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(av.id, f)
                      e.target.value = ''
                    }}
                  />
                  {isUploading ? '…' : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {av.relatorio_pdf_url ? 'Trocar' : 'Subir'}
                    </>
                  )}
                </label>
              )}

              {isJulia && av.relatorio_pdf_url && (
                <button
                  disabled={deleting === av.id}
                  onClick={() => handleDelete(av.id)}
                  className="flex items-center gap-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors font-medium disabled:opacity-50"
                  title="Apagar PDF"
                >
                  {deleting === av.id ? '…' : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}

              {isJulia && (
                <button
                  disabled={deletingAv === av.id}
                  onClick={() => handleDeleteAvaliacao(av.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2 py-1 rounded-lg transition-colors font-medium disabled:opacity-50"
                  title="Apagar lançamento"
                >
                  {deletingAv === av.id ? '…' : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}

              <Link to={`/seg-alimentar/${av.id}`} className="shrink-0">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Histórico combinado com abas ───────────────────────────────────────────────
function HistoricoAvaliacoes({ competencia, unidadeIds, setoresPermitidos }: { competencia: Competencia; unidadeIds: string[] | null; setoresPermitidos: string[] | null }) {
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
        ? <HistoricoOp competencia={competencia} unidadeIds={unidadeIds} setoresPermitidos={setoresPermitidos} />
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
  const verTudo = perfil?.ver_tudo === true
  const setoresPermitidos: string[] = perfil?.setores_avaliacao ?? []
  const podeNutri: boolean = perfil?.pode_nutri ?? false
  const unidadeIdsPermitidas: string[] | null = verTudo ? null : (perfil?.unidades_ids ?? null)
  // null = sem filtro (ver tudo); array = filtrar por esses setores
  const setoresParaFiltro: string[] | null = verTudo ? null : setoresPermitidos

  const { notasUnidades, sectorVisitCounts, loading: loadOp } = useDashboard(competencia, unidadeIdsPermitidas)
  const { data: nutriCounts = {} } = useNutriCounts(competencia)
  const { rows: sheetsRows } = useSegAlimentar(competencia)

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

  const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento - Maitres', 'Atendimento - Maitres Checklist', 'Atendimento - Pré evento']

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
          {(verTudo || setoresPermitidos.length > 0) && (
          <SecaoColapsavel titulo="Operacional" meta="visitas/mês por setor">
            {notasVisiveis.map((nu) => {
              const metaUnidade = metaOperacional(nu.unidade_nome)
              const counts = sectorVisitCounts[nu.unidade_id] ?? {}
              const setores = nu.notas_setores.filter((ns) => SETORES_OP.includes(ns.setor_nome))
              return (
                <div key={nu.unidade_id} className="px-4 py-3">
                  <div className="mb-2">
                    <span className="text-sm font-semibold text-gray-900">{nu.unidade_nome}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {setores.map((ns) => {
                      const sectorCount = counts[ns.setor_nome] ?? 0
                      const meta = metaSetorOp(ns.setor_nome) ?? metaUnidade
                      return (
                        <div key={ns.setor_id} className="text-center bg-gray-50 rounded-lg py-1.5 px-1">
                          <p className="text-xs text-gray-400 mb-0.5">{ns.setor_rotulo}</p>
                          <span className={`text-sm font-bold ${corClasse(ns.nota)}`}>{formatarNota(ns.nota)}</span>
                          <p className={`text-xs font-semibold mt-0.5 ${
                            meta === 0 ? 'text-gray-400'
                            : sectorCount >= meta ? 'text-green-600'
                            : sectorCount > 0    ? 'text-orange-500'
                            : 'text-red-500'
                          }`}>{sectorCount}/{meta}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </SecaoColapsavel>
          )}

          {(verTudo || podeNutri) && (
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

          <HistoricoAvaliacoes competencia={competencia} unidadeIds={unidadeIdsPermitidas} setoresPermitidos={setoresParaFiltro} />
        </>
      )}
    </div>
  )
}
