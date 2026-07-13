import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCompetencia } from '../context/CompetenciaContext'
import { useDashboard } from '../hooks/useDashboard'
import { useSegAlimentar } from '../hooks/useSegAlimentar'
import { useNutriReport } from '../hooks/useNutriAvaliacoes'
import { useChecklistCompliance, toChecklistSetores } from '../hooks/useChecklistDiario'
import { useAuth } from '../context/AuthContext'
import { CompetenciaSeletor } from '../components/CompetenciaSeletor'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { UnidadeSugestoesModal } from '../components/UnidadeSugestoesModal'
import { bgCorClasse, corClasse, formatarNota, variacaoSeta, variacaoCorClasse, competenciaAnterior } from '../utils/notas'
import { DB_TO_SHEET } from '../utils/unidades'
import type { NotaUnidade, Competencia } from '../types'
import { notaRede2524 } from '../utils/sheetsParser'
import type { NotaOperacao } from '../utils/sheetsParser'

const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

function avgNulls(arr: (number | null)[]): number | null {
  const v = arr.filter((n): n is number => n !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

// Maps setores_avaliacao values to the 3 dashboard-level sector names
function toSetoresDashboard(setoresAvaliacao: string[]): string[] {
  const result = new Set<string>()
  for (const s of setoresAvaliacao) {
    if (s === 'Cozinha') result.add('Cozinha')
    else if (s === 'Bar') result.add('Bar')
    else if (s.startsWith('Atendimento')) result.add('Atendimento')
  }
  return Array.from(result)
}

function gridCols(n: number) {
  if (n <= 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-2'
  return 'grid-cols-3'
}

function CardOp({ nu, setoresFiltro, onClick }: { nu: NotaUnidade; setoresFiltro: string[] | null; onClick: () => void }) {
  const setores = nu.notas_setores.filter((ns) =>
    SETORES_OP.includes(ns.setor_nome) && (setoresFiltro === null || setoresFiltro.includes(ns.setor_nome))
  )
  const consolidado = avgNulls(setores.map((ns) => ns.nota))

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:border-brand-400 cursor-pointer ${bgCorClasse(consolidado)}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{nu.unidade_nome}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-lg font-bold ${corClasse(consolidado)}`}>
            {formatarNota(consolidado)}
          </span>
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <div className={`grid ${gridCols(setores.length)} gap-1 border-t border-gray-100 pt-3`}>
        {setores.map((ns) => (
          <div key={ns.setor_id} className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">{ns.setor_rotulo}</p>
            <span className={`text-sm font-bold ${corClasse(ns.nota)}`}>{formatarNota(ns.nota)}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

function CardNutri({ row, setoresFiltro, onClick }: { row: NotaOperacao; setoresFiltro: string[] | null; onClick: () => void }) {
  const areas = (['Cozinha', 'Bar', 'Atendimento'] as const).filter(
    (a) => setoresFiltro === null || setoresFiltro.includes(a)
  )

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:border-brand-400 cursor-pointer ${bgCorClasse(row.consolidado)}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{row.unidade}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-lg font-bold ${corClasse(row.consolidado)}`}>
            {formatarNota(row.consolidado)}
          </span>
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <div className={`grid ${gridCols(areas.length)} gap-1 border-t border-gray-100 pt-3`}>
        {areas.map((area) => (
          <div key={area} className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">{area}</p>
            <span className={`text-sm font-bold ${corClasse(row[area])}`}>{formatarNota(row[area])}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

type ModalState =
  | { tipo: 'operacional'; unidade: NotaUnidade }
  | { tipo: 'nutri'; row: NotaOperacao }
  | null

function SecaoHeader({ label, nota, variacao }: { label: string; nota: number | null; variacao?: number | null }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">{label}</h3>
      {nota !== null && (
        <div className="flex items-center gap-2">
          {variacao != null && (
            <span className={`text-xs font-semibold ${variacaoCorClasse(variacao)}`}>
              {variacaoSeta(variacao)}{Math.abs(variacao).toFixed(1)}pp
            </span>
          )}
          <span className={`text-sm font-bold ${corClasse(nota)}`}>Rede: {nota.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

function CardChecklistCompliance({ unidade_id, unidade_nome, abertura, fechamento }: {
  unidade_id: string
  unidade_nome: string
  abertura: number
  fechamento: number
}) {
  const esperado = 6

  function corBarra(count: number) {
    if (count >= esperado) return 'bg-green-500'
    if (count > 0) return 'bg-yellow-400'
    return 'bg-red-400'
  }

  function corTexto(count: number) {
    if (count >= esperado) return 'text-green-600'
    if (count > 0) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <Link
      to={`/checklist-diario?unidade_id=${unidade_id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:border-brand-400"
    >
      <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-3">{unidade_nome}</h3>
      <div className="space-y-2">
        {(['abertura', 'fechamento'] as const).map((tipo) => {
          const count = tipo === 'abertura' ? abertura : fechamento
          const pct = esperado > 0 ? Math.min(count / esperado, 1) : 0
          return (
            <div key={tipo}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-400 capitalize">{tipo === 'abertura' ? 'Abertura' : 'Fechamento'}</span>
                <span className={`text-xs font-bold ${corTexto(count)}`}>
                  {count}/{esperado}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${corBarra(count)}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Link>
  )
}

export function Dashboard() {
  const { competencia } = useCompetencia()
  const { perfil } = useAuth()

  const verTudo = perfil?.ver_tudo === true
  const unidadeIdsPermitidas: string[] | null = verTudo ? null : (perfil?.unidades_ids ?? null)
  const checklistSetores = verTudo ? null : toChecklistSetores(perfil?.setores_avaliacao ?? [])
  // null = sem filtro (ver_tudo); array com nomes dos setores dashboard visíveis
  const setoresDash: string[] | null = verTudo ? null : toSetoresDashboard(perfil?.setores_avaliacao ?? [])

  const compAnt = useMemo(() => competenciaAnterior(competencia), [competencia])

  const { notasUnidades, notaRede, variacao, loading: loadOp, error: errOp } = useDashboard(competencia, unidadeIdsPermitidas)
  const { rows: sheetsRows, loading: loadNutriSheets, error: errNutri } = useSegAlimentar(competencia)
  const { rows: sheetsRowsAnt } = useSegAlimentar(compAnt)
  const { data: dbNutri, isLoading: loadNutriDB } = useNutriReport(competencia, unidadeIdsPermitidas)
  const { data: dbNutriAnt } = useNutriReport(compAnt, unidadeIdsPermitidas)
  const { data: compliance, isLoading: loadCompliance } = useChecklistCompliance(unidadeIdsPermitidas, checklistSetores)

  // Deriva nomes de unidades permitidas para filtrar dados de planilha
  const permittedSheetKeys = useMemo<string[] | null>(() => {
    if (!unidadeIdsPermitidas) return null
    return notasUnidades.flatMap((nu) => { const k = DB_TO_SHEET[nu.unidade_nome]; return k ? [k] : [] })
  }, [unidadeIdsPermitidas, notasUnidades])

  function matchSheet(name: string, keys: string[]) {
    return keys.some((k) => name === k || name.startsWith(k + ' ') || name.startsWith(k + '–') || name.startsWith(k + ' –'))
  }

  // Merge DB (primary) + Sheets (fallback for units not in DB), filtered for restricted users
  const rows = useMemo<NotaOperacao[]>(() => {
    const dbRows: NotaOperacao[] = (dbNutri ?? []).map((u) => ({
      unidade: u.unidade_nome,
      Cozinha: u.Cozinha,
      Bar: u.Bar,
      Atendimento: u.Atendimento,
      consolidado: u.consolidado,
      visitas: u.visitas,
    }))
    const dbNames = new Set(dbRows.map((r) => r.unidade.toLowerCase()))
    const filteredSheets = permittedSheetKeys
      ? sheetsRows.filter((r) => matchSheet(r.unidade, permittedSheetKeys))
      : sheetsRows
    const extraSheets = filteredSheets.filter((r) => !dbNames.has(r.unidade.toLowerCase()))
    return [...dbRows, ...extraSheets].sort((a, b) => a.unidade.localeCompare(b.unidade))
  }, [dbNutri, sheetsRows, permittedSheetKeys])

  const rowsAnt = useMemo<NotaOperacao[]>(() => {
    const dbRowsAnt: NotaOperacao[] = (dbNutriAnt ?? []).map((u) => ({
      unidade: u.unidade_nome, Cozinha: u.Cozinha, Bar: u.Bar, Atendimento: u.Atendimento,
      consolidado: u.consolidado, visitas: u.visitas,
    }))
    const dbNamesAnt = new Set(dbRowsAnt.map((r) => r.unidade.toLowerCase()))
    const filteredSheetsAnt = permittedSheetKeys
      ? sheetsRowsAnt.filter((r) => matchSheet(r.unidade, permittedSheetKeys))
      : sheetsRowsAnt
    return [...dbRowsAnt, ...filteredSheetsAnt.filter((r) => !dbNamesAnt.has(r.unidade.toLowerCase()))]
  }, [dbNutriAnt, sheetsRowsAnt, permittedSheetKeys])

  const notaRedeNutri = useMemo(() => notaRede2524(rows), [rows])
  const notaRedeNutriAnt = useMemo(() => notaRede2524(rowsAnt), [rowsAnt])
  const variacaoNutri = notaRedeNutri != null && notaRedeNutriAnt != null
    ? notaRedeNutri - notaRedeNutriAnt
    : null
  const loadNutri = loadNutriSheets || loadNutriDB
  const [modal, setModal] = useState<ModalState>(null)

  const unidadesComDados = notasUnidades.filter((nu) =>
    nu.notas_setores.some((ns) =>
      SETORES_OP.includes(ns.setor_nome) &&
      (setoresDash === null || setoresDash.includes(ns.setor_nome)) &&
      ns.nota !== null
    )
  )

  // Nota de rede calculada apenas sobre os setores visíveis para este usuário
  const notaRedeSetores = useMemo(() => {
    if (setoresDash === null) return notaRede
    const consolidados = unidadesComDados.map((nu) =>
      avgNulls(
        nu.notas_setores
          .filter((ns) => SETORES_OP.includes(ns.setor_nome) && setoresDash.includes(ns.setor_nome))
          .map((ns) => ns.nota)
      )
    )
    return avgNulls(consolidados)
  }, [notaRede, unidadesComDados, setoresDash])

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <CompetenciaSeletor />
      </div>

      {/* OPERACIONAL */}
      <section>
        <SecaoHeader label="Operacional" nota={notaRedeSetores} variacao={setoresDash === null ? variacao : null} />
        {loadOp ? (
          <LoadingSpinner text="Carregando..." />
        ) : errOp ? (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">Erro ao carregar dados operacionais.</div>
        ) : unidadesComDados.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Nenhuma avaliação operacional para esta competência.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {unidadesComDados.map((nu) => (
              <CardOp key={nu.unidade_id} nu={nu} setoresFiltro={setoresDash} onClick={() => setModal({ tipo: 'operacional', unidade: nu })} />
            ))}
          </div>
        )}
      </section>

      {/* SEG. ALIMENTAR & 5S */}
      <section>
        <SecaoHeader label="Seg. Alimentar & 5S" nota={notaRedeNutri} variacao={variacaoNutri} />
        {loadNutri ? (
          <LoadingSpinner text="Carregando..." />
        ) : errNutri ? (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">Erro ao carregar dados da planilha.</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Nenhum dado de seg. alimentar para esta competência.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((row) => (
              <CardNutri key={row.unidade} row={row} setoresFiltro={setoresDash} onClick={() => setModal({ tipo: 'nutri', row })} />
            ))}
          </div>
        )}
      </section>

      {/* CHECKLIST DIÁRIO — hidden when user has no checklist sectors */}
      {(verTudo || !checklistSetores || checklistSetores.length > 0) && (
        <section>
          <SecaoHeader
            label={`Checklist Diário${checklistSetores && checklistSetores.length > 0 ? ` — ${checklistSetores.join(', ')}` : ''}`}
            nota={null}
          />
          <p className="text-xs text-gray-400 -mt-2 mb-3">Preenchimentos desta semana (seg a dom)</p>
          {loadCompliance ? (
            <LoadingSpinner text="Carregando..." />
          ) : (compliance ?? []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              Nenhuma unidade com checklist configurado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(compliance ?? []).map((u) => (
                <CardChecklistCompliance key={u.unidade_id} {...u} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal de sugestões */}
      {modal && (
        modal.tipo === 'operacional' ? (
          <UnidadeSugestoesModal
            tipo="operacional"
            unidade={modal.unidade}
            competencia={competencia as Competencia}
            onClose={() => setModal(null)}
          />
        ) : (
          <UnidadeSugestoesModal
            tipo="nutri"
            row={modal.row}
            competencia={competencia as Competencia}
            onClose={() => setModal(null)}
          />
        )
      )}
    </div>
  )
}
