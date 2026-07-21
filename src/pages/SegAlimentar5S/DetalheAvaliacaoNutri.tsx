import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useNutriDetalhe } from '../../hooks/useNutriAvaliacoes'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ColoredScore } from '../../components/ColoredScore'
import { bgCorClasse, formatarDataBR, formatarMesAno } from '../../utils/notas'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

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

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export function DetalheAvaliacaoNutri() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useNutriDetalhe(id ?? '')
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
    setEditando(true)
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
    setSalvando(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=nutri`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { alert('Erro ao salvar.'); return }
      qc.invalidateQueries({ queryKey: ['nutri-detalhe', avaliacao.id] })
      qc.invalidateQueries({ queryKey: ['nutri-avaliacoes'] })
      setEditando(false)
      navigate(0)
    } finally {
      setSalvando(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))

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

      {/* Ações admin */}
      {isAdmin && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Ações administrativas</p>
          <div className="flex gap-3">
            <button
              onClick={abrirEdicao}
              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Editar
            </button>
            <button
              disabled={deletando}
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {deletando ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Editar avaliação</h3>

            <div className="space-y-3">
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
              {(['obs_cozinha', 'obs_bar', 'obs_atendimento'] as const).map((campo) => (
                <div key={campo}>
                  <label className="text-xs font-medium text-gray-500 mb-1 block capitalize">
                    Obs. {campo.replace('obs_', '')}
                  </label>
                  <textarea rows={2} value={editForm[campo]} onChange={set(campo)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Relatório técnico</label>
                <textarea rows={3} value={editForm.relatorio_tecnico} onChange={set('relatorio_tecnico')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditando(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button disabled={salvando} onClick={handleSave}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
