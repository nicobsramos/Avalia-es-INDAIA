import { useState, useMemo } from 'react'
import { useCompetencia } from '../context/CompetenciaContext'
import { useDashboard } from '../hooks/useDashboard'
import { useNutriReport } from '../hooks/useNutriAvaliacoes'
import { useChecklistCompliance, toChecklistSetores } from '../hooks/useChecklistDiario'
import { useAuth } from '../context/AuthContext'
import { CompetenciaSeletor } from '../components/CompetenciaSeletor'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { UnidadeSugestoesModal } from '../components/UnidadeSugestoesModal'
import { bgCorClasse, corClasse, formatarNota } from '../utils/notas'
import type { NotaUnidade, NotaSetor, Competencia } from '../types'

const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

function avgNulls(arr: (number | null)[]): number | null {
  const v = arr.filter((n): n is number => n !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function toSetoresDashboard(setoresAvaliacao: string[]): string[] {
  const result = new Set<string>()
  for (const s of setoresAvaliacao) {
    if (s === 'Cozinha') result.add('Cozinha')
    else if (s === 'Bar') result.add('Bar')
    else if (s.startsWith('Atendimento')) result.add('Atendimento')
  }
  return Array.from(result)
}

function extractCidade(nome: string): string {
  return nome.split(' – ')[0].trim()
}

function corCheck(count: number, esperado: number): string {
  if (count >= esperado) return 'text-green-600'
  if (count > 0) return 'text-yellow-600'
  return 'text-red-500'
}

interface UnidadeDashItem {
  nu: NotaUnidade
  cidade: string
  notaOp: number | null
  setoresOp: NotaSetor[]
  notaNutri: number | null
  checkAbr: number
  checkFech: number
  checkEsperado: number
  temChecklist: boolean
}

function CardUnificado({
  item,
  mostraChecklist,
  onClick,
}: {
  item: UnidadeDashItem
  mostraChecklist: boolean
  onClick: () => void
}) {
  const { nu, notaOp, notaNutri, checkAbr, checkFech, checkEsperado, setoresOp, temChecklist } = item
  const sufixo = nu.unidade_nome.includes(' – ')
    ? nu.unidade_nome.split(' – ').slice(1).join(' – ')
    : nu.unidade_nome

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:border-brand-400 cursor-pointer ${bgCorClasse(notaOp)}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{sufixo}</h3>
        <svg className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className={`grid ${mostraChecklist ? 'grid-cols-3' : 'grid-cols-2'} gap-2 border-t border-gray-100 pt-3`}>
        {/* Operacional */}
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5 text-center">Operacional</p>
          <p className={`text-sm font-bold text-center ${corClasse(notaOp)}`}>{formatarNota(notaOp)}</p>
          {setoresOp.length > 1 && (
            <div className="mt-1 space-y-0.5">
              {setoresOp.map((ns) => (
                <div key={ns.setor_id} className="flex justify-between text-[9px]">
                  <span className="text-gray-400">{ns.setor_rotulo}</span>
                  <span className={corClasse(ns.nota)}>{formatarNota(ns.nota)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seg. Alimentar */}
        <div className="text-center">
          <p className="text-[10px] text-gray-400 mb-0.5">Seg. Alim.</p>
          <p className={`text-sm font-bold ${corClasse(notaNutri)}`}>{formatarNota(notaNutri)}</p>
        </div>

        {/* Checklist */}
        {mostraChecklist && (
          <div className="text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Checklist</p>
            {temChecklist ? (
              <div className="text-xs font-semibold space-y-0.5">
                <p className={corCheck(checkAbr, checkEsperado)}>A {checkAbr}/{checkEsperado}</p>
                <p className={corCheck(checkFech, checkEsperado)}>F {checkFech}/{checkEsperado}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-300">—</p>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

export function Dashboard() {
  const { competencia } = useCompetencia()
  const { perfil } = useAuth()

  const verTudo = perfil?.ver_tudo === true
  const unidadeIdsPermitidas: string[] | null = verTudo ? null : (perfil?.unidades_ids ?? null)
  const checklistSetores = verTudo ? null : toChecklistSetores(perfil?.setores_avaliacao ?? [])
  const setoresDash: string[] | null = verTudo ? null : toSetoresDashboard(perfil?.setores_avaliacao ?? [])
  // If user has sectors but none map to standard names (empty array), treat as no filter so they see all data
  const setoresDashEff: string[] | null = setoresDash !== null && setoresDash.length === 0 ? null : setoresDash
  const podeVerChecklist = verTudo || !checklistSetores || checklistSetores.length > 0

  const { notasUnidades, loading: loadOp, error: errOp } = useDashboard(competencia, unidadeIdsPermitidas)
  const { data: dbNutri } = useNutriReport(competencia, unidadeIdsPermitidas)
  const { data: compliance } = useChecklistCompliance(unidadeIdsPermitidas, checklistSetores)

  const [modal, setModal] = useState<UnidadeDashItem | null>(null)

  const unidadesDash = useMemo<UnidadeDashItem[]>(() => {
    return notasUnidades
      .map((nu) => {
        const setoresVisiveis = nu.notas_setores.filter(
          (ns) => SETORES_OP.includes(ns.setor_nome) && (setoresDashEff === null || setoresDashEff.includes(ns.setor_nome)),
        )
        const nutriUnit = (dbNutri ?? []).find((d) => d.unidade_id === nu.unidade_id)
        const checkUnit = (compliance ?? []).find((c) => c.unidade_id === nu.unidade_id)

        // Show unit only if it has any data to display (op, nutri, or checklist)
        const hasOp = setoresVisiveis.some((ns) => ns.nota !== null)
        if (!hasOp && nutriUnit === undefined && checkUnit === undefined) return null

        return {
          nu,
          cidade: extractCidade(nu.unidade_nome),
          notaOp: hasOp ? avgNulls(setoresVisiveis.map((ns) => ns.nota)) : null,
          setoresOp: setoresVisiveis,
          notaNutri: nutriUnit?.consolidado ?? null,
          checkAbr: checkUnit?.abertura ?? 0,
          checkFech: checkUnit?.fechamento ?? 0,
          checkEsperado: checkUnit?.dias_operacao_semana ?? 6,
          temChecklist: checkUnit !== undefined,
        }
      })
      .filter((item): item is UnidadeDashItem => item !== null)
  }, [notasUnidades, dbNutri, compliance, setoresDashEff])

  const unidadesPorCidade = useMemo(() => {
    const map = new Map<string, UnidadeDashItem[]>()
    for (const item of unidadesDash) {
      if (!map.has(item.cidade)) map.set(item.cidade, [])
      map.get(item.cidade)!.push(item)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [unidadesDash])

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <CompetenciaSeletor />
      </div>

      {loadOp ? (
        <LoadingSpinner text="Carregando..." />
      ) : errOp ? (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
          Erro ao carregar dados.
        </div>
      ) : unidadesDash.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Nenhuma avaliação disponível para esta competência.
        </div>
      ) : (
        <div className="space-y-8">
          {unidadesPorCidade.map(([cidade, items]) => (
            <section key={cidade}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{cidade}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((item) => (
                  <CardUnificado
                    key={item.nu.unidade_id}
                    item={item}
                    mostraChecklist={podeVerChecklist}
                    onClick={() => setModal(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && (
        <UnidadeSugestoesModal
          tipo="combinado"
          unidade={modal.nu}
          notaNutri={modal.notaNutri}
          checkAbr={modal.checkAbr}
          checkFech={modal.checkFech}
          checkEsperado={modal.checkEsperado}
          temChecklist={modal.temChecklist}
          competencia={competencia as Competencia}
          setoresFiltro={setoresDashEff}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
