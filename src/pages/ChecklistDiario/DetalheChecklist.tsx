import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useChecklistDetalhe, useChecklistItens, useDeleteChecklist } from '../../hooks/useChecklistDiario'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const TIPO_LABEL: Record<string, string> = { abertura: 'Abertura', fechamento: 'Fechamento', pre_evento: 'Pré-evento' }
const GESTORES_CHECKLIST = new Set(['n.ramos.indaia@gmail.com', 'flaviavo05@gmail.com', 'laisalves.indaia@gmail.com', 'k.guatelli.indaia@gmail.com', 'g.bueno.indaia@gmail.com'])
const TIPO_COR: Record<string, string> = {
  abertura: 'bg-brand-100 text-brand-700',
  fechamento: 'bg-gray-200 text-gray-600',
  pre_evento: 'bg-green-100 text-green-700',
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function DetalheChecklist() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { data, isLoading, error } = useChecklistDetalhe(id)
  const { data: itens } = useChecklistItens(
    data?.checklist.tipo ?? 'abertura',
    data?.checklist.setor ? [data.checklist.setor] : undefined,
  )
  const deletar = useDeleteChecklist()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return (
    <div className="px-4 py-6">
      <LoadingSpinner text="Carregando checklist..." />
    </div>
  )

  if (error || !data) return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
        Checklist não encontrado ou sem permissão de acesso.
      </div>
      <button onClick={() => navigate('/checklist-diario')} className="mt-4 text-sm text-brand-600 hover:underline">
        Voltar
      </button>
    </div>
  )

  const { checklist, respostas } = data
  const respostaMap = Object.fromEntries(respostas.map((r) => [r.item_id, r]))

  const totalItens = respostas.length
  const totalFeito = respostas.filter((r) => r.feito).length
  const pct = totalItens > 0 ? Math.round((totalFeito / totalItens) * 100) : 0

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

  const isGestor = GESTORES_CHECKLIST.has(user?.email ?? '') || perfil?.ver_tudo === true
  const podeEditar = checklist.usuario_id === user?.id || isGestor
  const podeApagar = isGestor || (perfil?.role !== 'leitura' && checklist.usuario_id === user?.id)

  async function handleDelete() {
    await deletar.mutateAsync(id!)
    navigate('/checklist-diario')
  }

  return (
    <div className="pb-8">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/checklist-diario')} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate text-sm">
              {(checklist as any).unidade?.nome ?? ''}
            </p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TIPO_COR[checklist.tipo]}`}>
              {TIPO_LABEL[checklist.tipo]}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {formatarData(checklist.data_operacao)} • {checklist.responsavel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {podeEditar && (
            <Link
              to={`/checklist-diario/novo?tipo=${checklist.tipo}&unidade_id=${checklist.unidade_id}`}
              className="text-xs text-brand-600 hover:underline font-semibold"
            >
              Editar
            </Link>
          )}
          {podeApagar && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Apagar
            </button>
          )}
          {podeApagar && confirmDelete && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDelete}
                disabled={deletar.isPending}
                className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-2 py-1 rounded-md disabled:opacity-50"
              >
                {deletar.isPending ? '...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-600 font-semibold px-2 py-1"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {/* Resumo */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Itens concluídos</p>
            <p className="text-2xl font-bold text-gray-900">{totalFeito}<span className="text-base font-normal text-gray-400">/{totalItens}</span></p>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#f3f4f6" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke={pct >= 90 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6"
                strokeDasharray={`${pct * 1.634} 163.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
              pct >= 90 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
            }`}>
              {pct}%
            </span>
          </div>
        </div>

        {/* Itens por seção */}
        {secoes.map((secao) => (
          <div key={secao.titulo} className="space-y-2">
            <div className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{secao.titulo}</h3>
              <span className="text-xs text-gray-400">
                {(secao.itens ?? []).filter((i) => respostaMap[i.id]?.feito).length}/{(secao.itens ?? []).length}
              </span>
            </div>

            <div className="space-y-2">
              {(secao.itens ?? []).map((item) => {
                const resp = respostaMap[item.id]
                const feito = resp?.feito ?? false
                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl p-4 ${feito ? 'border-green-200 bg-green-50/20' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        feito ? 'bg-green-500 border-green-500' : 'bg-gray-100 border-gray-200'
                      }`}>
                        {feito && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {!feito && (
                          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm leading-snug ${feito ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                          {item.descricao}
                        </p>
                        {resp?.observacao && (
                          <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                            {resp.observacao}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Observações gerais */}
        {checklist.obs_gerais && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">
              Observações Gerais
            </p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{checklist.obs_gerais}</p>
          </div>
        )}

        {/* Rodapé de info */}
        <div className="text-center text-xs text-gray-400 pt-2">
          Preenchido em {new Date(checklist.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
