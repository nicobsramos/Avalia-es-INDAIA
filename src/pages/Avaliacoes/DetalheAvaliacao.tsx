import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
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
const COR_BTN_ATIVO: Record<number, string> = {
  1: 'bg-red-500 text-white border-red-500',
  2: 'bg-orange-400 text-white border-orange-400',
  3: 'bg-green-500 text-white border-green-500',
}
const COR_BTN_INATIVO = 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'

interface EditResposta {
  valor: 1 | 2 | 3 | null
  observacao: string
  obsAberta: boolean
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
  const [searchParams] = useSearchParams()
  const { data, isLoading, error } = useDetalheAvaliacao(id ?? '')
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = user?.email === ADMIN_EMAIL
  const isAdminView = isAdmin || perfil?.ver_tudo === true
  const isOwner = !!data && data.avaliacao.usuario_id === user?.id && perfil?.role !== 'leitura'
  const canEdit = isAdminView || isOwner

  const [deletando, setDeletando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editForm, setEditForm] = useState({ data_visita: '', competencia_mes: 0, competencia_ano: 0 })
  const [editRespostas, setEditRespostas] = useState<Record<string, EditResposta>>({})

  const autoEditDone = useRef(false)
  useEffect(() => {
    if (data && canEdit && searchParams.get('edit') === 'true' && !autoEditDone.current) {
      autoEditDone.current = true
      abrirEdicao()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, canEdit, searchParams])

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
    const respostas: Record<string, EditResposta> = {}
    for (const { itens } of notasPorSetor) {
      for (const item of itens) {
        respostas[item.item_id] = {
          valor: item.valor as 1 | 2 | 3,
          observacao: item.observacao ?? '',
          obsAberta: !!item.observacao,
        }
      }
    }
    setEditRespostas(respostas)
    setEditando(true)
  }

  function setValor(itemId: string, valor: 1 | 2 | 3) {
    setEditRespostas((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        valor,
        obsAberta: valor !== 3 ? true : (prev[itemId]?.obsAberta ?? false),
      },
    }))
  }

  function toggleObs(itemId: string) {
    setEditRespostas((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], obsAberta: !prev[itemId]?.obsAberta },
    }))
  }

  function setObservacao(itemId: string, observacao: string) {
    setEditRespostas((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], observacao },
    }))
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
      const respostasPayload = Object.entries(editRespostas)
        .filter(([, r]) => r.valor !== null)
        .map(([item_id, r]) => ({
          item_id,
          valor: r.valor,
          observacao: r.observacao,
        }))

      const res = await fetch(`/api/admin-avaliacao?id=${avaliacao.id}&tipo=operacional`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editForm, respostas: respostasPayload }),
      })
      if (!res.ok) { alert('Erro ao salvar.'); return }
      qc.invalidateQueries({ queryKey: ['avaliacao', avaliacao.id] })
      qc.invalidateQueries({ queryKey: ['avaliacoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditando(false)
      navigate(0)
    } finally {
      setSalvando(false)
    }
  }

  // ── MODO EDIÇÃO ──────────────────────────────────────────────────────────────
  if (editando) {
    return (
      <div className="pb-28">
        {/* Header fixo */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{avaliacao.unidade_nome}</p>
            <p className="text-xs text-gray-400">Editando avaliação</p>
          </div>
        </div>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
          {/* Metadados */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dados gerais</p>
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

          {/* Itens por setor */}
          {notasPorSetor.map(({ setor, itens }) => {
            const secoes = agruparPorSecao(itens)
            return (
              <div key={setor.id} className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                  {setor.rotulo}
                </p>
                {secoes.map(({ secao, itens: secItens }) => (
                  <div key={secao} className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-4">{secao}</p>
                    {secItens.map((item) => {
                      const st = editRespostas[item.item_id]
                      return (
                        <div
                          key={item.item_id}
                          className={`bg-white border rounded-xl p-4 space-y-3 transition-colors ${
                            st?.valor === 1 ? 'border-red-200' :
                            st?.valor === 2 ? 'border-orange-200' :
                            st?.valor === 3 ? 'border-green-200' : 'border-gray-200'
                          }`}
                        >
                          <p className="text-sm text-gray-800 leading-snug">{item.descricao}</p>
                          <div className="flex gap-2">
                            {([1, 2, 3] as const).map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setValor(item.item_id, v)}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                                  st?.valor === v ? COR_BTN_ATIVO[v] : COR_BTN_INATIVO
                                }`}
                              >
                                {LABEL_VALOR[v]}
                              </button>
                            ))}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => toggleObs(item.item_id)}
                              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              {st?.obsAberta ? 'Fechar obs.' : st?.observacao ? 'Ver/editar obs.' : 'Observação'}
                            </button>
                            {st?.obsAberta && (
                              <textarea
                                value={st.observacao}
                                onChange={(e) => setObservacao(item.item_id, e.target.value)}
                                placeholder="Observação ou não conformidade..."
                                rows={2}
                                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Botões fixos no rodapé */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10">
          <div className="max-w-lg mx-auto flex gap-3">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={handleSave}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
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

      {/* Ações */}
      {canEdit && (
        <div className={`border rounded-xl p-4 space-y-3 ${isAdminView ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isAdminView ? 'text-red-700' : 'text-gray-500'}`}>
            {isAdminView ? 'Ações administrativas' : 'Gerenciar avaliação'}
          </p>
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
    </div>
  )
}
