import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { parseCSV, processSheetData, processVisitasNutri, notaRede2524 } from '../utils/sheetsParser'
import type { Competencia } from '../types'

async function fetchCSV(): Promise<string> {
  const res = await fetch('/api/sheets')
  if (!res.ok) throw new Error('Erro ao carregar dados da planilha')
  return res.text()
}

export function useSegAlimentar(competencia: Competencia) {
  const csvQuery = useQuery({
    queryKey: ['sheets-csv'],
    queryFn: fetchCSV,
    staleTime: 1000 * 60 * 10,
  })

  const parsed = useMemo(
    () => (csvQuery.data ? parseCSV(csvQuery.data) : null),
    [csvQuery.data]
  )

  const rows = useMemo(
    () => (parsed ? processSheetData(parsed, competencia) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, competencia.mes, competencia.ano]
  )

  const visitas = useMemo(
    () => (parsed ? processVisitasNutri(parsed, competencia) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, competencia.mes, competencia.ano]
  )

  return {
    rows,
    visitas,
    notaRede: notaRede2524(rows),
    loading: csvQuery.isLoading,
    error: csvQuery.error,
  }
}
