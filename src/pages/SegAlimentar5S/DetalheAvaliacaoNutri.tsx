import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useNutriDetalhe, useNutriItens, type ValorNutri } from '../../hooks/useNutriAvaliacoes'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ColoredScore } from '../../components/ColoredScore'
import { bgCorClasse, formatarDataBR, formatarMesAno } from '../../utils/notas'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'
const AREAS = ['Cozinha', 'Bar', 'Atendimento'] as const
type Area = typeof AREAS[number]
const OBS_CAMPO: Record<Area, 'obs_cozinha' | 'obs_bar' | 'obs_atendimento'> = {
  Cozinha: 'obs_cozinha',
  Bar: 'obs_bar',
  Atendimento: 'obs_atendimento',
}

const VALOR_LABEL: Record<string, string> = {
  Conforme:      'Atende',
  Nao_Conforme:  'Não atende',
  Parcial:       'Parcial',
  Nao_Aplicavel: 'N/A',
}
const VALOR_BADGE: Record<string, string> = {
  Conforme:      'bg-green-100 text-green-700',
  Nao_Conforme:  'bg-red-100 text-red-700',
  Parcial:       'bg-orange-100 text-orange-700',
  Nao_Aplicavel: 'bg-gray-100 text-gray-500',
}
// Cores dos botões no modo de edição
const COR_VALOR: Record<ValorNutri, string> = {
  Conforme:      'bg-green-500 text-white border-green-500',
  Nao_Conforme:  'bg-red-500 text-white border-red-500',
  Parcial:       'bg-orange-400 text-white border-orange-400',
  Nao_Aplicavel: 'bg-gray-400 text-white border-gray-400',
}
const COR_INATIVO = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'

interface RespEdit {
  valor: ValorNutri | null
  observacao: string
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export function DetalheAvaliacaoNutri() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useNutriDetalhe(id ?? '')
  const { data: todosItens } = useNutriItens()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = user?.email === ADMIN_EMAIL

  const [deletando, setDeletando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editForm, setEditForm] = useState({
    data_visita: '',
    competencia_mes: 0,
    competencia_ano: 0,
    lideres_presentes: '',
    obs_cozinha: '',
    obs_bar: '',
    obs_atendimento: '',
    relatorio_tecnico: '',
  })
  const [editRespostas, setEditRespostas] = useState<Record<string, RespEdit>>({})

  if (isLoading) return <LoadingSpinner text="Carregando avaliação..." />
  if (error || !data) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
          Erro ao carregar avaliação.
        </div>
      </div>
    )
  }

  const { avaliacao, respostas, itens, notasPorArea, notaGeral } = data
  const respMap = Object.fromEntries(respostas.map((r) => [r.item_id, r]))

  const obsMap: Record<string, string | null> = {
    Cozinha:     avaliacao.obs_cozinha,
    Bar:         avaliacao.obs_bar,
    Atendimento: avaliacao.obs_atendimento,
  }

  const isOwner = !!user && avaliacao.usuario_id === user.id
  const canEdit = isAdmin || isOwner

  function abrirEdicao() {
    setEditForm({
      data_visita: avaliacao.data_visita,
      competencia_mes: avaliacao.competencia_mes,
      competencia_ano: avaliacao.competencia_ano,
      lideres_presentes: avaliacao.lideres_presentes ?? '',
      obs_cozinha: avaliacao.obs_cozinha ?? '',
      obs_bar: avaliacao.obs_bar ?? '',
      obs_atendimento: avaliacao.obs_atendimento ?? '',
      relatorio_tecnico: avaliacao.relatorio_tecnico ?? '',
    })
    // Inicializa a partir das respostas existentes (garante não perder nada,
    // mesmo se a lista completa de itens ainda não tiver carregado)
    const er: Record<string, RespEdit> = {}
    for (const r of respostas) {
      er[r.item_id] = { valor: r.valor as ValorNutri, observacao: r.observacao ?? '' }
    }
    setEditRespostas(er)
    setEditando(true)
  }

  function setValorEdit(itemId: string, valor: ValorNutri) {
    setEditRespostas((prev) => ({
      ...prev,
      [itemId]: { valor, observacao: prev[itemId]?.observacao ?? '' },
    }))
  }

  function setObsEdit(itemId: string, observacao: string) {
    setEditRespostas((prev) => ({
      ...prev,
      [itemId]: { valor: prev[itemId]?.valor ?? null, observacao },
    }))
  }

  async function handleDelete() {
    if (!confirm('Excluir esta avaliação permanentemente?')) return
    setDeletando(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=nutri`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { alert('Erro ao excluir.'); return }
      qc.invalidateQueries({ queryKey: ['nutri-avaliacoes'] })
      qc.invalidateQueries({ queryKey: ['nutri-report'] })
      navigate('/seg-alimentar')
    } finally {
      setDeletando(false)
    }
  }

  async function handleSave() {
    const respondidas = Object.entries(editRespostas).filter(([, v]) => v.valor != null)
    if (respondidas.length === 0) {
      alert('Responda pelo menos um item antes de salvar.')
      return
    }
    const semObs = respondidas.filter(([, v]) => v.valor !== 'Conforme' && !v.observacao.trim())
    if (semObs.length > 0) {
      alert(`Preencha a observação dos itens "Não atende", "Parcial" ou "N/A" (${semObs.length} pendente${semObs.length > 1 ? 's' : ''}).`)
      return
    }

    setSalvando(true)
    try {
      const respostasPayload = respondidas.map(([item_id, v]) => ({
        item_id,
        valor: v.valor,
        observacao: v.observacao,
      }))
      const token = await getToken()
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=nutri`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editForm, respostas: respostasPayload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        alert('Erro ao salvar: ' + ((body as { error?: string }).error ?? `código ${res.status}`))
        return
      }
      qc.invalidateQueries({ queryKey: ['nutri-detalhe', avaliacao.id] })
      qc.invalidateQueries({ queryKey: ['nutri-avaliacoes'] })
      qc.invalidateQueries({ queryKey: ['nutri-report'] })
      setEditando(false)
      navigate(0)
    } finally {
      setSalvando(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))

  // ── MODO EDIÇÃO ──────────────────────────────────────────────────────────────
  if (editando) {
    return (
      <div className="pb-28">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{avaliacao.unidade_nome}</p>
            <p className="text-xs text-gray-400">Editando avaliação</p>
          </div>
        </div>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
          {/* Dados gerais */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dados gerais</p>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data da visita</label>
              <input type="date" value={editForm.data_visita} onChange={set('data_visita')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Mês competência</label>
                <input type="number" min={1} max={12} value={editForm.competencia_mes}
                  onChange={(e) => setEditForm((f) => ({ ...f, competencia_mes: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Ano competência</label>
                <input type="number" value={editForm.competencia_ano}
                  onChange={(e) => setEditForm((f) => ({ ...f, competencia_ano: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Líderes presentes</label>
              <input type="text" value={editForm.lideres_presentes} onChange={set('lideres_presentes')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {/* Itens por área */}
          {AREAS.map((area) => (
            <section key={area}>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                {area}
                <span className="text-xs text-gray-400 font-normal ml-auto">{(todosItens?.[area] ?? []).length} itens</span>
              </h3>

              <div className="space-y-3">
                {(todosItens?.[area] ?? []).map((item) => {
                  const st = editRespostas[item.id]
                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm text-gray-800 leading-snug">{item.descricao}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Conforme', 'Nao_Conforme', 'Parcial', 'Nao_Aplicavel'] as ValorNutri[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setValorEdit(item.id, v)}
                            className={`py-3 rounded-lg text-xs font-bold border-2 transition-all min-h-[44px] leading-tight px-1 ${
                              st?.valor === v ? COR_VALOR[v] : COR_INATIVO
                            }`}
                          >
                            {VALOR_LABEL[v]}
                          </button>
                        ))}
                      </div>

                      {st?.valor != null && st.valor !== 'Conforme' ? (
                        <div>
                          <p className="text-xs font-medium text-red-500 mb-1.5">Observação obrigatória *</p>
                          <textarea
                            value={st.observacao}
                            onChange={(e) => setObsEdit(item.id, e.target.value)}
                            placeholder="Descreva o que foi observado..."
                            rows={2}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${
                              !st.observacao.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      ) : (
                        <textarea
                          value={st?.observacao ?? ''}
                          onChange={(e) => setObsEdit(item.id, e.target.value)}
                          placeholder="Observação (opcional)"
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Observação geral da área */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações gerais — {area}</label>
                <textarea
                  value={editForm[OBS_CAMPO[area]]}
                  onChange={set(OBS_CAMPO[area])}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </section>
          ))}

          {/* Relatório técnico */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relatório técnico da visita</label>
            <textarea value={editForm.relatorio_tecnico} onChange={set('relatorio_tecnico')} rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>

        {/* Barra fixa */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10">
          <div className="max-w-lg mx-auto flex gap-3">
            <button type="button" onClick={() => setEditando(false)}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" disabled={salvando} onClick={handleSave}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-bold py-3 rounded-xl transition-colors">
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MODO LEITURA ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/seg-alimentar" className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h2 className="text-xl font-bold text-gray-900 truncate">{avaliacao.unidade_nome}</h2>
      </div>

      {/* Cabeçalho */}
      <div className={`rounded-xl border p-5 ${bgCorClasse(notaGeral)}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm text-gray-500">{formatarDataBR(avaliacao.data_visita)}</p>
            <p className="text-sm text-gray-500">{avaliacao.usuario_nome}</p>
            {avaliacao.lideres_presentes && (
              <p className="text-sm text-gray-500">Líderes: {avaliacao.lideres_presentes}</p>
            )}
            <p className="text-sm text-gray-500">
              Competência: {formatarMesAno(avaliacao.competencia_mes, avaliacao.competencia_ano)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Nota geral</p>
            <ColoredScore nota={notaGeral} size="xl" />
          </div>
        </div>
      </div>

      {/* Notas por área */}
      <div className="grid grid-cols-3 gap-3">
        {notasPorArea.map((na) => (
          <div key={na.area} className={`rounded-xl border p-3 text-center ${bgCorClasse(na.nota)}`}>
            <p className="text-xs text-gray-500 mb-1">{na.area}</p>
            <ColoredScore nota={na.nota} size="md" />
            <p className="text-xs text-gray-400 mt-1">{na.conforme}/{na.total} conf.</p>
          </div>
        ))}
      </div>

      {/* Detalhes por área */}
      {(['Cozinha', 'Bar', 'Atendimento'] as const).map((area) => {
        const itensArea = itens.filter((i) => i.area === area)
        if (itensArea.length === 0) return null
        const notaArea = notasPorArea.find((n) => n.area === area)
        const obs = obsMap[area]

        return (
          <div key={area} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-3 border-b ${bgCorClasse(notaArea?.nota ?? null)}`}>
              <h3 className="font-semibold text-gray-900">{area}</h3>
              <ColoredScore nota={notaArea?.nota ?? null} size="md" />
            </div>
            <div className="divide-y divide-gray-100">
              {itensArea.map((item) => {
                const resp = respMap[item.id]
                if (!resp) return null
                return (
                  <div key={item.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-800 leading-snug flex-1">{item.descricao}</p>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${VALOR_BADGE[resp.valor]}`}>
                        {VALOR_LABEL[resp.valor]}
                      </span>
                    </div>
                    {resp.observacao && (
                      <p className="text-xs text-gray-500 italic bg-gray-50 rounded px-2 py-1">
                        {resp.observacao}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {obs && (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                <p className="text-xs font-semibold text-amber-700 mb-0.5">Observações gerais</p>
                <p className="text-sm text-gray-700">{obs}</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Relatório técnico */}
      {avaliacao.relatorio_tecnico && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-brand-700 mb-1">Relatório técnico</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{avaliacao.relatorio_tecnico}</p>
        </div>
      )}

      {/* Ações */}
      {canEdit && (
        <div className={`border rounded-xl p-4 space-y-3 ${isAdmin ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isAdmin ? 'text-red-700' : 'text-gray-500'}`}>
            {isAdmin ? 'Ações administrativas' : 'Editar avaliação'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={abrirEdicao}
              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Editar respostas
            </button>
            {isAdmin && (
              <button
                disabled={deletando}
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {deletando ? 'Excluindo…' : 'Excluir'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
