import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useChecklist, useUnidades } from '../../hooks/useChecklist'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { calcularCompetencia, formatarMesAno } from '../../utils/notas'
import type { RespostaItem } from '../../types'

const LABEL_VALOR: Record<number, string> = { 1: 'Não atende', 2: 'Parcial', 3: 'Atende' }
const COR_VALOR: Record<number, string> = {
  1: 'bg-red-500 text-white border-red-500',
  2: 'bg-orange-400 text-white border-orange-400',
  3: 'bg-green-500 text-white border-green-500',
}
const COR_INATIVO = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'

interface ItemState {
  valor: 1 | 2 | 3 | null
  observacao: string
  obsAberta: boolean
}

export function NovaAvaliacao() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, perfil } = useAuth()
  const setoresPermitidos: string[] = perfil?.setores_avaliacao ?? []
  const { data: unidades, isLoading: loadingUnidades } = useUnidades()
  const { data: setoresComItensRaw, isLoading: loadingChecklist } = useChecklist()
  const setoresComItens = setoresPermitidos.length > 0
    ? (setoresComItensRaw ?? []).filter((sc) => setoresPermitidos.includes(sc.setor.nome))
    : (setoresComItensRaw ?? [])

  const [unidadeId, setUnidadeId] = useState('')
  const [dataVisita, setDataVisita] = useState(() => new Date().toISOString().slice(0, 10))
  const [itensState, setItensState] = useState<Record<string, ItemState>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [passo, setPasso] = useState<1 | 2>(1)

  function setValor(itemId: string, valor: 1 | 2 | 3) {
    setItensState((prev) => ({
      ...prev,
      [itemId]: {
        valor,
        observacao: prev[itemId]?.observacao ?? '',
        obsAberta: valor !== 3 ? true : (prev[itemId]?.obsAberta ?? false),
      },
    }))
  }

  function setObservacao(itemId: string, observacao: string) {
    setItensState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], observacao },
    }))
  }

  function toggleObs(itemId: string) {
    setItensState((prev) => ({
      ...prev,
      [itemId]: {
        valor: prev[itemId]?.valor ?? null,
        observacao: prev[itemId]?.observacao ?? '',
        obsAberta: !prev[itemId]?.obsAberta,
      },
    }))
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    setErro('')

    const respostas: RespostaItem[] = []
    for (const sc of setoresComItens ?? []) {
      for (const secao of sc.secoes) {
        for (const item of secao.itens) {
          const st = itensState[item.id]
          if (st?.valor != null) {
            respostas.push({ item_id: item.id, setor_id: sc.setor.id, valor: st.valor, observacao: st.observacao })
          }
        }
      }
    }

    if (respostas.length === 0) {
      setErro('Responda pelo menos um item antes de salvar.')
      return
    }

    const semObs = respostas.filter((r) => r.valor !== 3 && !r.observacao?.trim())
    if (semObs.length > 0) {
      setErro(`Preencha a observação dos itens marcados como "Não atende" ou "Parcial" (${semObs.length} pendente${semObs.length > 1 ? 's' : ''}).`)
      return
    }

    setSalvando(true)
    const competencia = calcularCompetencia(new Date(dataVisita + 'T12:00:00'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: avData, error: avError } = await (supabase as any)
      .from('avaliacoes')
      .insert({
        usuario_id: user!.id,
        unidade_id: unidadeId,
        data_visita: dataVisita,
        competencia_mes: competencia.mes,
        competencia_ano: competencia.ano,
      })
      .select('id')
      .single()

    if (avError || !avData) {
      setSalvando(false)
      setErro('Erro ao salvar avaliação: ' + (avError?.message ?? 'desconhecido'))
      return
    }

    const avId = (avData as { id: string }).id

    const linhas = respostas.map((r) => ({
      avaliacao_id: avId,
      setor_id: r.setor_id,
      item_id: r.item_id,
      valor: r.valor,
      observacao: r.observacao || null,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rsError } = await (supabase as any)
      .from('avaliacao_respostas')
      .insert(linhas)

    if (rsError) {
      setSalvando(false)
      setErro('Avaliação criada, mas houve erro ao salvar respostas: ' + rsError.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['historico-av'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['competencias-disponiveis'] })

    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'operacional',
        unidade: (unidades ?? []).find((u) => u.id === unidadeId)?.nome ?? '',
        usuario_nome: perfil?.nome ?? '',
        data_visita: dataVisita.split('-').reverse().join('/'),
        competencia: formatarMesAno(competencia.mes, competencia.ano),
      }),
    }).catch(() => {})

    navigate('/avaliacoes')
  }

  if (loadingUnidades || loadingChecklist) return <LoadingSpinner text="Carregando formulário..." />

  if (passo === 1) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/avaliacoes')} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">Nova Avaliação</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Selecione a unidade...</option>
              {(unidades ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data da visita</label>
            <input
              type="date"
              value={dataVisita}
              onChange={(e) => setDataVisita(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <button
          disabled={!unidadeId}
          onClick={() => setPasso(2)}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-colors"
        >
          Avançar para o checklist
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSalvar} className="pb-28">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => setPasso(1)} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm">
            {(unidades ?? []).find((u) => u.id === unidadeId)?.nome ?? ''}
          </p>
          <p className="text-xs text-gray-400">{dataVisita.split('-').reverse().join('/')}</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {setoresComItens.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-amber-800">Nenhum setor disponível para avaliação</p>
            <p className="text-xs text-amber-700">
              Seu usuário não tem setores configurados ou os setores atribuídos foram renomeados.
              Peça ao administrador para atualizar suas permissões em <strong>Admin → Usuários</strong>.
            </p>
          </div>
        )}
        {(setoresComItens ?? []).map((sc) => (
          <div key={sc.setor.id} className="space-y-5">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
              {sc.setor.rotulo}
            </h3>

            {sc.secoes.length === 0 ? (
              <p className="text-sm text-gray-400 italic px-2">Nenhum item cadastrado.</p>
            ) : (
              sc.secoes.map((secao) => (
                <div key={secao.titulo}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                    {secao.titulo}
                  </p>
                  <div className="space-y-3">
                    {secao.itens.map((item) => {
                      const st = itensState[item.id]
                      return (
                        <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                          <p className="text-sm text-gray-800 leading-snug">{item.descricao}</p>

                          <div className="grid grid-cols-3 gap-2">
                            {([3, 2, 1] as const).map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setValor(item.id, v)}
                                className={`py-3 rounded-lg text-xs font-bold border-2 transition-all min-h-[44px] ${
                                  st?.valor === v ? COR_VALOR[v] : COR_INATIVO
                                }`}
                              >
                                {LABEL_VALOR[v]}
                              </button>
                            ))}
                          </div>

                          {st?.valor != null && st.valor !== 3 ? (
                            <div>
                              <p className="text-xs font-medium text-red-500 mb-1.5">
                                Observação obrigatória *
                              </p>
                              <textarea
                                value={st.observacao}
                                onChange={(e) => setObservacao(item.id, e.target.value)}
                                placeholder="Descreva o que foi observado..."
                                rows={2}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${
                                  !st.observacao.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                              />
                            </div>
                          ) : (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleObs(item.id)}
                                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                {st?.obsAberta ? 'Fechar observação' : 'Adicionar observação'}
                              </button>
                              {st?.obsAberta && (
                                <textarea
                                  value={st?.observacao ?? ''}
                                  onChange={(e) => setObservacao(item.id, e.target.value)}
                                  placeholder="Observação opcional..."
                                  rows={2}
                                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ))}

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10">
        <button
          type="submit"
          disabled={salvando}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold py-4 rounded-xl transition-colors text-base"
        >
          {salvando ? 'Salvando...' : 'Salvar avaliação'}
        </button>
      </div>
    </form>
  )
}
