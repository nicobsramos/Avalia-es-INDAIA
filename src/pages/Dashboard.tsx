import { useState } from 'react'
import { useCompetencia } from '../context/CompetenciaContext'
import { useDashboard } from '../hooks/useDashboard'
import { useSegAlimentar } from '../hooks/useSegAlimentar'
import { CompetenciaSeletor } from '../components/CompetenciaSeletor'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { UnidadeSugestoesModal } from '../components/UnidadeSugestoesModal'
import { bgCorClasse, corClasse, formatarNota, variacaoSeta, variacaoCorClasse } from '../utils/notas'
import type { NotaUnidade, Competencia } from '../types'
import type { NotaOperacao } from '../utils/sheetsParser'

const SETORES_OP = ['Cozinha', 'Bar', 'Atendimento']

function avgNulls(arr: (number | null)[]): number | null {
  const v = arr.filter((n): n is number => n !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function CardOp({ nu, onClick }: { nu: NotaUnidade; onClick: () => void }) {
  const setores = nu.notas_setores.filter((ns) => SETORES_OP.includes(ns.setor_nome))
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
      <div className="grid grid-cols-3 gap-1 border-t border-gray-100 pt-3">
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

function CardNutri({ row, onClick }: { row: NotaOperacao; onClick: () => void }) {
  const areas = ['Cozinha', 'Bar', 'Atendimento'] as const

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
      <div className="grid grid-cols-3 gap-1 border-t border-gray-100 pt-3">
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

export function Dashboard() {
  const { competencia } = useCompetencia()
  const { notasUnidades, notaRede, variacao, loading: loadOp, error: errOp } = useDashboard(competencia)
  const { rows, notaRede: notaRedeNutri, loading: loadNutri, error: errNutri } = useSegAlimentar(competencia)
  const [modal, setModal] = useState<ModalState>(null)

  const unidadesComDados = notasUnidades.filter((nu) =>
    nu.notas_setores.some((ns) => SETORES_OP.includes(ns.setor_nome) && ns.nota !== null)
  )

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <CompetenciaSeletor />
      </div>

      {/* OPERACIONAL */}
      <section>
        <SecaoHeader label="Operacional" nota={notaRede} variacao={variacao} />
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
              <CardOp key={nu.unidade_id} nu={nu} onClick={() => setModal({ tipo: 'operacional', unidade: nu })} />
            ))}
          </div>
        )}
      </section>

      {/* SEG. ALIMENTAR & 5S */}
      <section>
        <SecaoHeader label="Seg. Alimentar & 5S" nota={notaRedeNutri} />
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
              <CardNutri key={row.unidade} row={row} onClick={() => setModal({ tipo: 'nutri', row })} />
            ))}
          </div>
        )}
      </section>

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
