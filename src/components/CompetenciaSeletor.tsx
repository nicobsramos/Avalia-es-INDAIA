import { useEffect, useRef } from 'react'
import { useCompetencia } from '../context/CompetenciaContext'
import { useCompetenciasDisponiveis } from '../hooks/useCompetenciasDisponiveis'
import { formatarCompetencia } from '../utils/notas'

export function CompetenciaSeletor() {
  const { competencia, setCompetencia } = useCompetencia()
  const { data: opcoes = [] } = useCompetenciasDisponiveis()
  const syncedRef = useRef(false)

  useEffect(() => {
    if (!syncedRef.current && opcoes.length > 0) {
      syncedRef.current = true
      setCompetencia(opcoes[0])
    }
  }, [opcoes])

  const valor = `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="competencia-sel" className="text-sm text-gray-500 whitespace-nowrap">
        Competência
      </label>
      <select
        id="competencia-sel"
        value={valor}
        onChange={(e) => {
          const [ano, mes] = e.target.value.split('-').map(Number)
          setCompetencia({ mes, ano })
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
