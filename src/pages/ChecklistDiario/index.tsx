import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useChecklistList, useChecklistCompliance, useDeleteChecklist, toChecklistSetores } from '../../hooks/useChecklistDiario'
import { useUnidades } from '../../hooks/useChecklist'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'
const GESTORES_CHECKLIST = new Set([ADMIN_EMAIL, 'flaviavo05@gmail.com', 'laisalves.indaia@gmail.com', 'k.guatelli.indaia@gmail.com', 'g.bueno.indaia@gmail.com'])

// Usuários que só visualizam histórico — não preenchem checklists
const APENAS_HISTORICO = new Set([
  'n.ramos.indaia@gmail.com',
  'laisalves.indaia@gmail.com',
  'k.guatelli.indaia@gmail.com',
  'g.bueno.indaia@gmail.com',
])

const TODAY = new Date().toISOString().split('T')[0]

const TIPO_COR: Record<string, string> = {
  abertura: 'bg-brand-100 text-brand-700',
  fechamento: 'bg-gray-200 text-gray-600',
  pre_evento: 'bg-green-100 text-green-700',
}

const TIPO_LABEL: Record<string, string> = {
  abertura: 'Abertura',
  fechamento: 'Fechamento',
  pre_evento: 'Pré-evento',
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function statusCorBorda(abertura: number, fechamento: number, esperado: number) {
  const min = Math.min(abertura, fechamento)
  if (min >= esperado) return 'border-green-400'
  if (min > 0) return 'border-yellow-400'
  return 'border-red-300'
}

function statusCorTexto(abertura: number, fechamento: number, esperado: number) {
  const min = Math.min(abertura, fechamento)
  if (min >= esperado) return 'text-green-600'
  if (min > 0) return 'text-yellow-600'
  return 'text-red-500'
}

function CardUnidadeHoje({
  unidadeId,
  unidadeNome,
  checklistsHoje,
  podeApagar,
  podePreencher,
  onDelete,
  mostrarPreEvento,
}: {
  unidadeId: string
  unidadeNome: string
  checklistsHoje: { id: string; tipo: string }[]
  podeApagar: boolean
  podePreencher: boolean
  onDelete: (id: string) => void
  mostrarPreEvento: boolean
}) {
  const navigate = useNavigate()
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const tiposFeitos = new Set(checklistsHoje.map((c) => c.tipo))
  const tipos: Array<'abertura' | 'fechamento' | 'pre_evento'> = mostrarPreEvento
    ? ['abertura', 'fechamento', 'pre_evento']
    : ['abertura', 'fechamento']

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">{unidadeNome}</h3>
      <div className={`grid gap-2 ${tipos.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tipos.map((tipo) => {
          const feito = tiposFeitos.has(tipo)
          const existente = checklistsHoje.find((c) => c.tipo === tipo)
          return (
            <div
              key={tipo}
              className={`rounded-lg p-3 border-2 text-center ${feito ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-200 bg-gray-50'}`}
            >
              <p className={`text-xs font-semibold mb-1 ${feito ? 'text-green-700' : 'text-gray-400'}`}>
                {TIPO_LABEL[tipo]}
              </p>
              {feito ? (
                <>
                  <Link
                    to={`/checklist-diario/${existente!.id}`}
                    className="text-xs text-green-600 underline block"
                  >
                    Ver preenchido
                  </Link>
                  {podeApagar && (
                    confirmandoId === existente!.id ? (
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        <button
                          onClick={() => { onDelete(existente!.id); setConfirmandoId(null) }}
                          className="text-xs bg-red-500 text-white font-semibold px-2 py-0.5 rounded"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmandoId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoId(existente!.id)}
                        className="mt-1.5 text-xs text-red-400 hover:text-red-600 font-medium"
                      >
                        Apagar
                      </button>
                    )
                  )}
                </>
              ) : podePreencher ? (
                <button
                  onClick={() => navigate(`/checklist-diario/novo?tipo=${tipo}&unidade_id=${unidadeId}`)}
                  className="text-xs text-brand-600 font-semibold hover:underline"
                >
                  Preencher agora
                </button>
              ) : (
                <span className="text-xs text-gray-300">Não preenchido</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ViewLider({ checklistSetores }: { checklistSetores: string[] }) {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const unidadeIds = perfil?.unidades_ids
  // Array vazio = sem setor configurado → hook retorna [] sem vazar checklists de outros setores
  const setoresFiltro = checklistSetores.length > 0 ? checklistSetores : []
  const { data: unidades, isLoading: loadUnidades } = useUnidades(unidadeIds)
  const { data: lista, isLoading: loadLista, error } = useChecklistList(unidadeIds, setoresFiltro)
  const deletar = useDeleteChecklist()
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  if (loadUnidades || loadLista) return <LoadingSpinner text="Carregando..." />
  if (error) return (
    <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
      Erro ao carregar checklists.
    </div>
  )

  // Gestores podem apagar qualquer um; líderes não-leitura podem apagar os próprios
  const podeApagar = perfil?.ver_tudo === true || GESTORES_CHECKLIST.has(user?.email ?? '') || perfil?.role !== 'leitura'
  const podePreencher = !APENAS_HISTORICO.has(user?.email ?? '')
  const hoje = (lista ?? []).filter((c) => c.data_operacao === TODAY)
  const historico = (lista ?? []).filter((c) => c.data_operacao !== TODAY)

  async function handleDelete(id: string) {
    await deletar.mutateAsync(id)
    setConfirmandoId(null)
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Checklist Diário</h2>

      {/* Status de hoje por unidade */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Hoje — {formatarData(TODAY)}
        </p>
        {(unidades ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma unidade vinculada.</p>
        ) : (
          <div className="space-y-3">
            {(unidades ?? []).map((u) => (
              <CardUnidadeHoje
                key={u.id}
                unidadeId={u.id}
                unidadeNome={u.nome}
                checklistsHoje={hoje.filter((c) => c.unidade_id === u.id)}
                podeApagar={podeApagar}
                podePreencher={podePreencher}
                onDelete={handleDelete}
                mostrarPreEvento={checklistSetores.includes('Atendimento')}
              />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      {historico.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Histórico Recente
          </p>
          <div className="space-y-2">
            {historico.map((c) => (
              <div key={c.id} className="flex items-center bg-white border border-gray-200 rounded-xl hover:border-brand-400 hover:shadow-sm transition-all">
                <Link
                  to={`/checklist-diario/${c.id}`}
                  className="flex-1 flex items-center justify-between px-4 py-3 min-w-0"
                >
                  <div>
                    <p className="text-xs text-gray-500">{formatarData(c.data_operacao)}</p>
                    <p className="text-sm font-medium text-gray-900">{(c as any).unidade?.nome ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COR[c.tipo]}`}>
                      {TIPO_LABEL[c.tipo]}
                    </span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                {podeApagar && (
                  <div className="shrink-0 pr-3">
                    {confirmandoId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletar.isPending}
                          className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-2 py-1 rounded-md disabled:opacity-50"
                        >
                          {deletar.isPending ? '...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setConfirmandoId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoId(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {lista?.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Nenhum checklist preenchido ainda.
          <br />
          <button
            onClick={() => navigate('/checklist-diario/novo')}
            className="mt-3 text-brand-600 font-semibold hover:underline"
          >
            Preencher o primeiro
          </button>
        </div>
      )}
    </div>
  )
}

function ViewRede({ setores }: { setores?: string[] | null }) {
  const { user, perfil } = useAuth()
  const { data: compliance, isLoading, error } = useChecklistCompliance(undefined, setores)
  const { data: lista, isLoading: loadLista } = useChecklistList()
  const deletar = useDeleteChecklist()
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  if (isLoading || loadLista) return <LoadingSpinner text="Carregando..." />
  if (error) return (
    <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
      Erro ao carregar dados.
    </div>
  )

  const podeApagar = perfil?.ver_tudo === true || GESTORES_CHECKLIST.has(user?.email ?? '')
  const historico = (lista ?? []).slice(0, 50)

  async function handleDelete(id: string) {
    await deletar.mutateAsync(id)
    setConfirmandoId(null)
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Checklist Diário</h2>

      {/* Compliance da semana */}
      <section>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Semana atual — preenchimentos (seg a dom)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {(compliance ?? []).map((u) => {
            const esperado = 6
            return (
              <div
                key={u.unidade_id}
                className={`bg-white border-2 rounded-xl p-4 ${statusCorBorda(u.abertura, u.fechamento, esperado)}`}
              >
                <p className="font-semibold text-gray-900 text-sm mb-3">{u.unidade_nome}</p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {(['abertura', 'fechamento'] as const).map((tipo) => {
                    const count = tipo === 'abertura' ? u.abertura : u.fechamento
                    return (
                      <div key={tipo} className="bg-gray-50 rounded-lg py-2 px-1">
                        <p className="text-xs text-gray-400 mb-0.5">{TIPO_LABEL[tipo]}</p>
                        <p className={`text-base font-bold ${statusCorTexto(count, count, esperado)}`}>
                          {count}<span className="text-xs font-normal text-gray-400">/{esperado}</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Histórico */}
      {historico.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Últimos preenchimentos
          </p>
          <div className="space-y-2">
            {historico.map((c) => (
              <div key={c.id} className="flex items-center bg-white border border-gray-200 rounded-xl hover:border-brand-400 hover:shadow-sm transition-all">
                <Link
                  to={`/checklist-diario/${c.id}`}
                  className="flex-1 flex items-center justify-between px-4 py-3 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{formatarData(c.data_operacao)}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{(c as any).unidade?.nome ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COR[c.tipo]}`}>
                      {TIPO_LABEL[c.tipo]}
                    </span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
                {podeApagar && (
                  <div className="shrink-0 pr-3">
                    {confirmandoId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletar.isPending}
                          className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-2 py-1 rounded-md disabled:opacity-50"
                        >
                          {deletar.isPending ? '...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setConfirmandoId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoId(c.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function ChecklistDiario() {
  const { perfil, user } = useAuth()
  const checklistSetores = toChecklistSetores(perfil?.setores_avaliacao ?? [])

  if (perfil?.ver_tudo === true || user?.email === ADMIN_EMAIL) return <ViewRede setores={null} />

  return <ViewLider checklistSetores={checklistSetores} />
}
