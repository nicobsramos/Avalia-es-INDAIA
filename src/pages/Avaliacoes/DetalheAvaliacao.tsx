import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useDetalheAvaliacao } from '../../hooks/useAvaliacoes'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ColoredScore } from '../../components/ColoredScore'
import { formatarDataBR, formatarMesAno, bgCorClasse } from '../../utils/notas'
import type { ItemDetalhe } from '../../hooks/useAvaliacoes'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

const LABEL_VALOR: Record<number, string> = { 1: 'Não atende', 2: 'Parcial', 3: 'Atende' }
const COR_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border border-red-200',
  2: 'bg-orange-100 text-orange-700 border border-orange-200',
  3: 'bg-green-100 text-green-700 border border-green-200',
}

function agruparPorSecao(itens: ItemDetalhe[]): { secao: string; itens: ItemDetalhe[] }[] {
  const map = new Map<string, ItemDetalhe[]>()
  for (const item of itens) {
    const key = item.secao ?? 'Geral'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).map(([secao, itens]) => ({ secao, itens }))
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export function DetalheAvaliacao() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useDetalheAvaliacao(id ?? '')
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = user?.email === ADMIN_EMAIL

  const [deletando, setDeletando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editForm, setEditForm] = useState({ data_visita: '', competencia_mes: 0, competencia_ano: 0 })

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

  const { avaliacao, notasPorSetor, notaGeral } = data

  function abrirEdicao() {
    setEditForm({
      data_visita: avaliacao.data_visita,
      competencia_mes: avaliacao.competencia_mes,
      competencia_ano: avaliacao.competencia_ano,
    })
    setEditando(true)
  }

  async function handleDelete() {
    if (!confirm('Excluir esta avaliação permanentemente?')) return
    setDeletando(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=operacional`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { alert('Erro ao excluir.'); return }
      qc.invalidateQueries({ queryKey: ['avaliacoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/avaliacoes')
    } finally {
      setDeletando(false)
    }
  }

  async function handleSave() {
    setSalvando(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=operacional`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { alert('Erro ao salvar.'); return }
      qc.invalidateQueries({ queryKey: ['detalhe-avaliacao', avaliacao.id] })
      qc.invalidateQueries({ queryKey: ['avaliacoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditando(false)
      navigate(0)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link to="/avaliacoes" className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h2 className="text-xl font-bold text-gray-900 truncate">{avaliacao.unidade_nome}</h2>
      </div>

      <div className={`rounded-xl border p-5 ${bgCorClasse(notaGeral)}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm text-gray-700 font-medium">
              {formatarDataBR(avaliacao.data_visita)}
            </p>
            {avaliacao.usuario_nome && (
              <p className="text-xs text-gray-500">por {avaliacao.usuario_nome}</p>
            )}
            <p className="text-xs text-gray-500">
              Competência: {formatarMesAno(avaliacao.competencia_mes, avaliacao.competencia_ano)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Nota geral</p>
            <ColoredScore nota={notaGeral} size="xl" />
          </div>
        </div>
      </div>

      {/* Resumo por setor */}
      <div className={`grid gap-2 ${notasPorSetor.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {notasPorSetor.map(({ setor, nota }) => (
          <div key={setor.id} className={`rounded-xl border p-3 text-center ${bgCorClasse(nota)}`}>
            <p className="text-xs text-gray-500 mb-1">{setor.rotulo}</p>
            <ColoredScore nota={nota} size="md" />
          </div>
        ))}
      </div>

      {/* Detalhes por setor → seção → itens */}
      {notasPorSetor.map(({ setor, nota, itens }) => {
        const secoes = agruparPorSecao(itens)
        const naoAtende = itens.filter((i) => i.valor === 1).length
        const parcial = itens.filter((i) => i.valor === 2).length
        return (
          <div key={setor.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-3 border-b ${bgCorClasse(nota)}`}>
              <div>
                <h3 className="font-semibold text-gray-900">{setor.rotulo}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {itens.length} itens avaliados
                  {naoAtende > 0 && <span className="text-red-600 font-medium"> · {naoAtende} não atende</span>}
                  {parcial > 0 && <span className="text-orange-600 font-medium"> · {parcial} parcial</span>}
                </p>
              </div>
              <ColoredScore nota={nota} size="md" />
            </div>
            {secoes.map(({ secao, itens: secItens }) => (
              <div key={secao}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{secao}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {secItens.map((item) => (
                    <div key={item.item_id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-800 leading-snug flex-1">{item.descricao}</p>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${COR_BADGE[item.valor]}`}>
                          {LABEL_VALOR[item.valor]}
                        </span>
                      </div>
                      {item.observacao && (
                        <p className="text-xs text-gray-500 italic bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                          💬 {item.observacao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}

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
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Editar avaliação</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Data da visita</label>
                <input
                  type="date"
                  value={editForm.data_visita}
                  onChange={(e) => setEditForm((f) => ({ ...f, data_visita: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Mês competência</label>
                  <input
                    type="number" min={1} max={12}
                    value={editForm.competencia_mes}
                    onChange={(e) => setEditForm((f) => ({ ...f, competencia_mes: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Ano competência</label>
                  <input
                    type="number"
                    value={editForm.competencia_ano}
                    onChange={(e) => setEditForm((f) => ({ ...f, competencia_ano: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditando(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={salvando}
                onClick={handleSave}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
