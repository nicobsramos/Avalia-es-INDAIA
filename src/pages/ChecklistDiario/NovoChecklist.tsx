import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUnidades } from '../../hooks/useChecklist'
import {
  useChecklistItens,
  useChecklistExistente,
  useSalvarChecklist,
  toChecklistSetores,
} from '../../hooks/useChecklistDiario'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const TIPO_LABEL = { abertura: 'Abertura', fechamento: 'Fechamento' }

interface ItemState {
  feito: boolean
  observacao: string
  obsAberta: boolean
  naAplicavel?: boolean
}

function detectarTipoPadrao(): 'abertura' | 'fechamento' {
  const hora = new Date().getHours()
  return hora < 14 ? 'abertura' : 'fechamento'
}

function getJanela(tipo: 'abertura' | 'fechamento'): {
  bloqueado: boolean
  dataOperacao: string
  mensagem: string
} {
  const now = new Date()
  const hora = now.getHours()

  if (tipo === 'abertura') {
    // Abertura: aceita de 00h às 16h59; bloqueada das 17h às 23h59
    const bloqueado = hora >= 17
    return {
      bloqueado,
      dataOperacao: now.toISOString().slice(0, 10),
      mensagem: 'Horário encerrado para abertura. O prazo vai de 00h às 17h.',
    }
  }

  // Fechamento: aceita das 17h às 04h59 do dia seguinte
  // Na madrugada (00h–04h59) a competência é o dia anterior
  const bloqueado = hora >= 5 && hora < 17
  let dataOp: string
  if (hora < 5) {
    const ontem = new Date(now)
    ontem.setDate(ontem.getDate() - 1)
    dataOp = ontem.toISOString().slice(0, 10)
  } else {
    dataOp = now.toISOString().slice(0, 10)
  }
  return {
    bloqueado,
    dataOperacao: dataOp,
    mensagem: 'Horário encerrado para fechamento. O prazo vai das 17h às 05h do dia seguinte.',
  }
}

export function NovoChecklist() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, perfil } = useAuth()

  const [passo, setPasso] = useState<1 | 2>(1)
  const [unidadeId, setUnidadeId] = useState(params.get('unidade_id') ?? '')
  const [tipo, setTipo] = useState<'abertura' | 'fechamento'>(
    (params.get('tipo') as 'abertura' | 'fechamento') ?? detectarTipoPadrao(),
  )
  const [responsavel, setResponsavel] = useState(perfil?.nome ?? '')
  const [itensState, setItensState] = useState<Record<string, ItemState>>({})
  const [obsGerais, setObsGerais] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const janela = getJanela(tipo)
  const dataOperacao = janela.dataOperacao

  const checklistSetores = toChecklistSetores(perfil?.setores_avaliacao ?? [])
  const verTudo = perfil?.ver_tudo === true
  const isGestor = verTudo || ['n.ramos.indaia@gmail.com', 'flaviavo05@gmail.com'].includes(user?.email ?? '')
  const unidadeIds = verTudo ? null : (perfil?.unidades_ids ?? null)
  const { data: unidades, isLoading: loadUnidades } = useUnidades(unidadeIds ?? undefined)
  const { data: itens, isLoading: loadItens } = useChecklistItens(tipo, checklistSetores.length > 0 ? checklistSetores : undefined)
  const { data: existente, isLoading: loadExistente } = useChecklistExistente(
    unidadeId || undefined,
    tipo,
    dataOperacao,
    checklistSetores[0] ?? null,
  )
  const salvar = useSalvarChecklist()

  useEffect(() => {
    if (perfil?.nome) setResponsavel(perfil.nome)
  }, [perfil?.nome])

  // Auto-seleciona quando o usuário tem exatamente 1 unidade
  useEffect(() => {
    if (unidades?.length === 1 && !unidadeId) setUnidadeId(unidades[0].id)
  }, [unidades, unidadeId])

  // Quando muda tipo, reseta itens
  useEffect(() => {
    setItensState({})
  }, [tipo])

  // Se existente foi carregado e tem dados, pre-carregar respostas
  // (para edição do mesmo autor)
  const podeEditar = existente && (existente.usuario_id === user?.id || isGestor)

  function setFeito(itemId: string, feito: boolean) {
    setItensState((prev) => ({
      ...prev,
      [itemId]: { feito, observacao: prev[itemId]?.observacao ?? '', obsAberta: prev[itemId]?.obsAberta ?? false },
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
        feito: prev[itemId]?.feito ?? false,
        observacao: prev[itemId]?.observacao ?? '',
        obsAberta: !prev[itemId]?.obsAberta,
      },
    }))
  }

  function toggleItemNA(itemId: string) {
    setItensState((prev) => {
      const isNA = prev[itemId]?.naAplicavel ?? false
      return {
        ...prev,
        [itemId]: isNA
          ? { feito: false, observacao: '', obsAberta: false, naAplicavel: false }
          : { feito: true, observacao: 'Dia sem evento — não se aplica', obsAberta: false, naAplicavel: true },
      }
    })
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    if (!unidadeId || !user) return
    if (janela.bloqueado) { setErro(janela.mensagem); return }
    setErro('')
    setSalvando(true)

    try {
      const respostas = (itens ?? []).map((item) => ({
        item_id: item.id,
        feito: itensState[item.id]?.feito ?? false,
        observacao: itensState[item.id]?.observacao ?? '',
      }))

      const id = await salvar.mutateAsync({
        id: podeEditar ? existente.id : undefined,
        usuario_id: user.id,
        unidade_id: unidadeId,
        tipo,
        data_operacao: dataOperacao,
        responsavel,
        obs_gerais: obsGerais,
        setor: checklistSetores[0] ?? null,
        respostas,
      })

      navigate(`/checklist-diario/${id}`)
    } catch (err: unknown) {
      console.error('Erro ao salvar checklist:', err)
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
      setErro('Erro ao salvar: ' + msg)
      setSalvando(false)
    }
  }

  // Organizar itens por seção
  const secoes = (itens ?? []).reduce<{ titulo: string; itens: typeof itens }[]>((acc, item) => {
    const last = acc[acc.length - 1]
    if (last && last.titulo === item.secao) {
      last.itens!.push(item)
    } else {
      acc.push({ titulo: item.secao, itens: [item] })
    }
    return acc
  }, [])

  const totalItens = itens?.length ?? 0
  const totalFeito = Object.values(itensState).filter((s) => s.feito).length
  const nomeUnidade = (unidades ?? []).find((u) => u.id === unidadeId)?.nome ?? ''

  if (loadUnidades) return <LoadingSpinner text="Carregando..." />

  // PASSO 1 — seleção de contexto
  if (passo === 1) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/checklist-diario')} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">Novo Checklist</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['abertura', 'fechamento'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                    tipo === t
                      ? t === 'abertura'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Unidade — oculta o seletor se o usuário tem apenas 1 */}
          {(unidades ?? []).length !== 1 && (
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
          )}

          {/* Data de operação (calculada automaticamente pelo horário) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de operação</label>
            <div className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-gray-50 text-gray-500">
              {dataOperacao.split('-').reverse().join('/')}
            </div>
          </div>

          {/* Aviso de horário bloqueado */}
          {janela.bloqueado && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-700 text-sm space-y-0.5">
              <p className="font-semibold">Fora do horário permitido</p>
              <p>{janela.mensagem}</p>
            </div>
          )}

          {/* Responsável */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável pelo turno</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Aviso se já existe */}
          {!loadExistente && existente && (
            <div className={`rounded-lg p-3 text-sm ${podeEditar ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {podeEditar ? (
                <>
                  Já existe um checklist de <strong>{TIPO_LABEL[tipo]}</strong> para esta unidade nesta data (preenchido por você).
                  Avançar irá <strong>substituir</strong> os dados anteriores.
                </>
              ) : (
                <>
                  Já existe um checklist de <strong>{TIPO_LABEL[tipo]}</strong> para esta unidade nesta data, preenchido por outro usuário.{' '}
                  <button
                    type="button"
                    onClick={() => navigate(`/checklist-diario/${existente.id}`)}
                    className="underline font-semibold"
                  >
                    Ver preenchimento
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          disabled={!unidadeId || !responsavel.trim() || (!loadExistente && !!existente && !podeEditar) || janela.bloqueado}
          onClick={() => setPasso(2)}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-colors"
        >
          Avançar para o checklist →
        </button>
      </div>
    )
  }

  // PASSO 2 — preenchimento
  return (
    <form onSubmit={handleSalvar} className="pb-28">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => setPasso(1)} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate text-sm">{nomeUnidade}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              tipo === 'abertura' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {TIPO_LABEL[tipo]}
            </span>
          </div>
          <p className="text-xs text-gray-400">{dataOperacao.split('-').reverse().join('/')} • {responsavel}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-sm font-bold ${totalFeito === totalItens ? 'text-green-600' : 'text-gray-600'}`}>
            {totalFeito}/{totalItens}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {loadItens ? (
          <LoadingSpinner text="Carregando itens..." />
        ) : secoes.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-amber-800">Nenhum item disponível para seu setor</p>
            <p className="text-xs text-amber-700">
              Seu usuário não tem setores configurados ou ainda não há itens cadastrados para seu setor.
              Peça ao administrador para atualizar suas permissões em <strong>Admin → Usuários</strong>.
            </p>
          </div>
        ) : (
          secoes.map((secao) => {
            const mostrarBotaoNA = secao.titulo === 'Verificações' && checklistSetores.includes('Atendimento')
            return (
            <div key={secao.titulo} className="space-y-2">
              <div className="flex items-center gap-2 py-1">
                <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {secao.titulo}
                </h3>
              </div>

              <div className="space-y-2">
                {(secao.itens ?? []).map((item) => {
                  const st = itensState[item.id]
                  const feito = st?.feito ?? false
                  const isNA = st?.naAplicavel ?? false

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl p-4 transition-colors ${
                        isNA ? 'border-gray-200 bg-gray-50 opacity-60' :
                        feito ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setFeito(item.id, !feito)}
                          className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            feito
                              ? 'bg-green-500 border-green-500'
                              : 'bg-white border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {feito && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <p className={`text-sm leading-snug flex-1 ${feito ? 'text-gray-500 line-through decoration-green-400' : 'text-gray-800'}`}>
                          {item.descricao}
                        </p>
                      </div>

                      <div className="mt-2 ml-9">
                        <button
                          type="button"
                          onClick={() => toggleObs(item.id)}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {st?.obsAberta ? 'Fechar obs.' : 'Observação'}
                        </button>
                        {st?.obsAberta && (
                          <textarea
                            value={st.observacao}
                            onChange={(e) => setObservacao(item.id, e.target.value)}
                            placeholder="Observação ou não conformidade..."
                            rows={2}
                            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          />
                        )}
                      </div>

                      {mostrarBotaoNA && (
                        <button
                          type="button"
                          onClick={() => toggleItemNA(item.id)}
                          className={`w-full mt-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                            isNA
                              ? 'bg-gray-400 text-white border-gray-400'
                              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          Dia sem evento — N/A
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
          })
        )}

        {/* Observações gerais */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Observações Gerais / Não Conformidades
          </label>
          <textarea
            value={obsGerais}
            onChange={(e) => setObsGerais(e.target.value)}
            placeholder="Registre aqui observações gerais ou não conformidades do turno..."
            rows={4}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
        )}
      </div>

      {/* Botão fixo no rodapé */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto">
          <button
            type="submit"
            disabled={salvando || loadItens}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold py-4 rounded-xl transition-colors text-base"
          >
            {salvando ? 'Salvando...' : `Salvar checklist (${totalFeito}/${totalItens} feitos)`}
          </button>
        </div>
      </div>
    </form>
  )
}
