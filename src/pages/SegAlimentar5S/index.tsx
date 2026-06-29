import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSegAlimentar } from '../../hooks/useSegAlimentar'
import { useCompetenciasDisponiveis } from '../../hooks/useCompetenciasDisponiveis'
import { useNutriAvaliacoesList } from '../../hooks/useNutriAvaliacoes'
import { useAuth } from '../../context/AuthContext'
import { LoadingSpinner, EmptyState } from '../../components/LoadingSpinner'
import { ColoredScore } from '../../components/ColoredScore'
import {
  bgCorClasse, corClasse, formatarNota, variacaoSeta, variacaoCorClasse,
  formatarCompetencia, formatarDataBR, formatarMesAno, competenciaAtual,
} from '../../utils/notas'
import { notaRede2524 } from '../../utils/sheetsParser'
import type { NotaOperacao } from '../../utils/sheetsParser'
import type { Competencia } from '../../types'

type Tab = 'relatorio' | 'historico'
type AreaKey = 'Cozinha' | 'Bar' | 'Atendimento'


function CompetenciaSeletor({ competencia, opcoes, onChange }: { competencia: Competencia; opcoes: Competencia[]; onChange: (c: Competencia) => void }) {
  const valor = `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-500 whitespace-nowrap">Competência</label>
      <select
        value={valor}
        onChange={(e) => {
          const [ano, mes] = e.target.value.split('-').map(Number)
          onChange({ mes, ano })
        }}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {opcoes.map((o) => {
          const v = `${o.ano}-${String(o.mes).padStart(2, '0')}`
          return <option key={v} value={v}>{formatarCompetencia(o)}</option>
        })}
      </select>
    </div>
  )
}

function CardUnidade({ row }: { row: NotaOperacao }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-3 ${bgCorClasse(row.consolidado)}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-tight text-sm">{row.unidade}</h3>
        <span className="text-xs text-gray-400 shrink-0">{row.visitas} visita{row.visitas !== 1 ? 's' : ''}</span>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Consolidado</p>
        <ColoredScore nota={row.consolidado} size="xl" />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
        {(['Cozinha', 'Bar', 'Atendimento'] as AreaKey[]).map((area) => (
          <div key={area} className="text-center">
            <p className="text-xs text-gray-500 mb-1">{area}</p>
            <span className={`text-base font-bold ${corClasse(row[area])}`}>
              {formatarNota(row[area])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Relatorio({ competencia, opcoes, onChange }: { competencia: Competencia; opcoes: Competencia[]; onChange: (c: Competencia) => void }) {
  const compAnt: Competencia =
    competencia.mes === 1
      ? { mes: 12, ano: competencia.ano - 1 }
      : { mes: competencia.mes - 1, ano: competencia.ano }

  const { rows, loading, error } = useSegAlimentar(competencia)
  const { rows: rowsAnt } = useSegAlimentar(compAnt)

  const notaRedeAtual = notaRede2524(rows)
  const notaRedeAnt = notaRede2524(rowsAnt)
  const variacao = notaRedeAtual !== null && notaRedeAnt !== null ? notaRedeAtual - notaRedeAnt : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-gray-400">Ciclo: dia 25 a dia 24 do mês seguinte</p>
        <CompetenciaSeletor competencia={competencia} opcoes={opcoes} onChange={onChange} />
      </div>

      {/* Card rede */}
      <div className="bg-brand-900 text-white rounded-2xl p-6 shadow-lg">
        <p className="text-brand-200 text-sm font-medium mb-1">Nota geral da rede</p>
        <div className="flex items-end gap-4">
          <span className="text-5xl font-extrabold">
            {notaRedeAtual !== null ? notaRedeAtual.toFixed(1) + '%' : '—'}
          </span>
          {variacao !== null && (
            <div className={`flex items-center gap-1 mb-1 text-lg font-semibold ${variacaoCorClasse(variacao)}`}>
              <span>{variacaoSeta(variacao)}</span>
              <span>{Math.abs(variacao).toFixed(1)}pp</span>
            </div>
          )}
        </div>
        <p className="text-brand-300 text-xs mt-2">
          vs. {formatarCompetencia(compAnt)}{variacao === null ? ' (sem dados)' : ''}
        </p>
      </div>

      {loading ? (
        <LoadingSpinner text="Carregando dados da planilha..." />
      ) : error ? (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
          Erro ao carregar dados. Verifique a conexão.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Nenhum dado encontrado para esta competência na planilha.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <CardUnidade key={row.unidade} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function Historico({ unidadeIds }: { unidadeIds: string[] | null }) {
  const { data: avaliacoes, isLoading, error } = useNutriAvaliacoesList()

  const avaliacoesVisiveis = unidadeIds !== null
    ? (avaliacoes ?? []).filter((av) => unidadeIds.includes((av as any).unidade_id))
    : (avaliacoes ?? [])

  return (
    <div className="space-y-4">

      {isLoading ? (
        <LoadingSpinner text="Carregando avaliações..." />
      ) : error ? (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">Erro ao carregar avaliações.</div>
      ) : avaliacoesVisiveis.length === 0 ? (
        <EmptyState text="Nenhuma avaliação registrada ainda." />
      ) : (
        <div className="space-y-2">
          {avaliacoesVisiveis.map((av) => (
            <Link
              key={av.id}
              to={`/seg-alimentar/${av.id}`}
              className="block bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-brand-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{av.unidade_nome}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatarDataBR(av.data_visita)}
                  </p>
                </div>
                <span className="shrink-0 text-xs bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded-full">
                  {formatarMesAno(av.competencia_mes, av.competencia_ano)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function SegAlimentar5S() {
  const { perfil } = useAuth()
  const isLeitura = perfil?.role === 'leitura'
  const unidadeIdsPermitidas: string[] | null = isLeitura ? (perfil?.unidades_ids ?? []) : null

  const { data: opcoes = [] } = useCompetenciasDisponiveis()
  const [tab, setTab] = useState<Tab>('relatorio')
  const [competencia, setCompetencia] = useState<Competencia>(competenciaAtual)
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!syncedRef.current && opcoes.length > 0) {
      syncedRef.current = true
      setCompetencia(opcoes[0])
    }
  }, [opcoes])

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900">Seg. Alimentar & 5S</h2>
      </div>

      <div className="flex border-b border-gray-200">
        {([['relatorio', 'Relatório'], ['historico', 'Histórico']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'relatorio' ? (
        <Relatorio competencia={competencia} opcoes={opcoes} onChange={setCompetencia} />
      ) : (
        <Historico unidadeIds={unidadeIdsPermitidas} />
      )}
    </div>
  )
}
