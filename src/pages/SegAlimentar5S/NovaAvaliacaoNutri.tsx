import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useUnidades } from '../../hooks/useChecklist'
import { useNutriItens, useInvalidateNutri, type ValorNutri } from '../../hooks/useNutriAvaliacoes'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { calcularCompetencia, formatarMesAno } from '../../utils/notas'

const AREAS = ['Cozinha', 'Bar', 'Atendimento'] as const
type Area = typeof AREAS[number]

const COR_VALOR: Record<ValorNutri, string> = {
  Conforme:      'bg-green-500 text-white border-green-500',
  Nao_Conforme:  'bg-red-500 text-white border-red-500',
  Parcial:       'bg-orange-400 text-white border-orange-400',
  Nao_Aplicavel: 'bg-gray-400 text-white border-gray-400',
}
const COR_INATIVO = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'

const LABEL_VALOR: Record<ValorNutri, string> = {
  Conforme:      'Atende',
  Nao_Conforme:  'Não atende',
  Parcial:       'Parcial',
  Nao_Aplicavel: 'N/A',
}

interface ItemState {
  valor: ValorNutri | null
  observacao: string
  obsAberta: boolean
}


export function NovaAvaliacaoNutri() {
  const navigate = useNavigate()
  const invalidate = useInvalidateNutri()
  const { user, perfil } = useAuth()
  const { data: unidades, isLoading: loadingUnidades } = useUnidades()
  const { data: itens, isLoading: loadingItens } = useNutriItens()

  const [passo, setPasso] = useState<1 | 2>(1)
  const [unidadeId, setUnidadeId] = useState('')
  const [dataVisita, setDataVisita] = useState(() => new Date().toISOString().slice(0, 10))
  const [lideres, setLideres] = useState('')
  const [relatorio, setRelatorio] = useState('')
  const [obsAreas, setObsAreas] = useState<Record<Area, string>>({ Cozinha: '', Bar: '', Atendimento: '' })
  const [estado, setEstado] = useState<Record<string, ItemState>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function setValor(itemId: string, valor: ValorNutri) {
    setEstado((prev) => ({
      ...prev,
      [itemId]: {
        valor,
        observacao: prev[itemId]?.observacao ?? '',
        obsAberta: valor !== 'Conforme' ? true : (prev[itemId]?.obsAberta ?? false),
      },
    }))
  }

  function toggleObs(itemId: string) {
    setEstado((prev) => ({
      ...prev,
      [itemId]: {
        valor: prev[itemId]?.valor ?? null,
        observacao: prev[itemId]?.observacao ?? '',
        obsAberta: !prev[itemId]?.obsAberta,
      },
    }))
  }

  function contarArea(area: Area) {
    const its = itens?.[area] ?? []
    return its.filter((i) => estado[i.id]?.valor != null).length
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    setErro('')

    const total = Object.values(estado).filter((s) => s.valor != null).length
    if (total === 0) {
      setErro('Responda pelo menos um item antes de salvar.')
      return
    }

    const semObs = Object.values(estado).filter((s) => s.valor != null && s.valor !== 'Conforme' && !s.observacao.trim())
    if (semObs.length > 0) {
      setErro(`Preencha a observação dos itens marcados como "Não conforme" ou "N/A" (${semObs.length} pendente${semObs.length > 1 ? 's' : ''}).`)
      return
    }

    setSalvando(true)

    const comp = calcularCompetencia(new Date(dataVisita + 'T12:00:00'))

    const { data: avData, error: avErr } = await (supabase as any)
      .from('nutri_avaliacoes')
      .insert({
        usuario_id:       user!.id,
        unidade_id:       unidadeId,
        data_visita:      dataVisita,
        competencia_mes:  comp.mes,
        competencia_ano:  comp.ano,
        lideres_presentes: lideres || null,
        obs_cozinha:      obsAreas.Cozinha || null,
        obs_bar:          obsAreas.Bar || null,
        obs_atendimento:  obsAreas.Atendimento || null,
        relatorio_tecnico: relatorio || null,
      })
      .select('id')
      .single()

    if (avErr || !avData) {
      setSalvando(false)
      setErro('Erro ao salvar: ' + (avErr?.message ?? 'desconhecido'))
      return
    }

    const avId = (avData as { id: string }).id

    const respostas: object[] = []
    for (const area of AREAS) {
      for (const item of itens?.[area] ?? []) {
        const st = estado[item.id]
        if (st?.valor != null) {
          respostas.push({
            avaliacao_id: avId,
            item_id:      item.id,
            valor:        st.valor,
            observacao:   st.observacao || null,
          })
        }
      }
    }

    const { error: rsErr } = await (supabase as any)
      .from('nutri_respostas')
      .insert(respostas)

    if (rsErr) {
      setSalvando(false)
      setErro('Avaliação salva, mas erro nas respostas: ' + rsErr.message)
      return
    }

    invalidate()

    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'nutri',
        unidade: (unidades ?? []).find((u) => u.id === unidadeId)?.nome ?? '',
        usuario_nome: perfil?.nome ?? '',
        data_visita: dataVisita.split('-').reverse().join('/'),
        competencia: formatarMesAno(comp.mes, comp.ano),
      }),
    }).catch(() => {})

    navigate('/seg-alimentar')
  }

  if (loadingUnidades || loadingItens) return <LoadingSpinner text="Carregando formulário..." />

  // ---- PASSO 1 ----
  if (passo === 1) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/seg-alimentar')} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">Nova Avaliação Nutri</h2>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Líderes presentes <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={lideres}
              onChange={(e) => setLideres(e.target.value)}
              placeholder="Ex: João, Maria"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <button
          disabled={!unidadeId}
          onClick={() => setPasso(2)}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-colors"
        >
          Avançar para o checklist →
        </button>
      </div>
    )
  }

  // ---- PASSO 2: CHECKLIST ----
  return (
    <form onSubmit={handleSalvar} className="pb-32">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => setPasso(1)} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
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
        <div className="flex gap-2 shrink-0">
          {AREAS.map((area) => (
            <span key={area} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {area[0]}: {contarArea(area)}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-8">
        {AREAS.map((area) => (
          <section key={area}>
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 sticky top-[57px] bg-gray-50 py-2 z-[5]">
              <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
              {area}
              <span className="text-xs text-gray-400 font-normal ml-auto">
                {itens?.[area]?.length ?? 0} itens
              </span>
            </h3>

            <div className="space-y-3">
              {(itens?.[area] ?? []).map((item) => {
                const st = estado[item.id]
                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-gray-800 leading-snug">{item.descricao}</p>

                    <div className="grid grid-cols-2 gap-2">
                      {(['Conforme', 'Nao_Conforme', 'Parcial', 'Nao_Aplicavel'] as ValorNutri[]).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setValor(item.id, v)}
                          className={`py-3 rounded-lg text-xs font-bold border-2 transition-all min-h-[44px] leading-tight px-1 ${
                            st?.valor === v ? COR_VALOR[v] : COR_INATIVO
                          }`}
                        >
                          {LABEL_VALOR[v]}
                        </button>
                      ))}
                    </div>

                    {st?.valor != null && st.valor !== 'Conforme' ? (
                      <div>
                        <p className="text-xs font-medium text-red-500 mb-1.5">
                          Observação obrigatória *
                        </p>
                        <textarea
                          value={st.observacao}
                          onChange={(e) =>
                            setEstado((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], observacao: e.target.value },
                            }))
                          }
                          placeholder="Descreva o que foi observado..."
                          rows={2}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${
                            !st.observacao.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleObs(item.id)}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {st?.obsAberta ? 'Fechar' : 'Observação'}
                        </button>
                        {st?.obsAberta && (
                          <textarea
                            value={st?.observacao ?? ''}
                            onChange={(e) =>
                              setEstado((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], observacao: e.target.value },
                              }))
                            }
                            placeholder="Observação sobre este item..."
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          />
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Observação geral da área */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Observações gerais — {area}
              </label>
              <textarea
                value={obsAreas[area]}
                onChange={(e) => setObsAreas((prev) => ({ ...prev, [area]: e.target.value }))}
                placeholder={`Observações gerais sobre ${area}...`}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </section>
        ))}

        {/* Relatório técnico */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relatório técnico da visita</label>
          <textarea
            value={relatorio}
            onChange={(e) => setRelatorio(e.target.value)}
            placeholder="Resumo geral, pontos críticos, recomendações..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
      </div>

      {/* Botão fixo */}
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
