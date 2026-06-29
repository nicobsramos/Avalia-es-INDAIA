import type { Competencia } from '../types'
import { INDE_MERGE_KEY } from './unidades'

// Column ranges (0-indexed, inclusive)
const AREAS = {
  Cozinha:    { start: 5,  end: 50 },
  Bar:        { start: 52, end: 89 },
  Atendimento:{ start: 91, end: 115 },
} as const

export type AreaKey = keyof typeof AREAS

export interface NotaOperacao {
  unidade: string
  Cozinha: number | null
  Bar: number | null
  Atendimento: number | null
  consolidado: number | null
  visitas: number
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

export function parseCSV(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map(parseCSVLine)
}

function scoreArea(row: string[], start: number, end: number): number | null {
  const values = row.slice(start, end + 1)
  const applicable = values.filter(
    (v) => v !== '' && v !== 'Não aplicável' && v !== 'Não Aplicável' && v !== 'NA' && v !== 'N/A'
  )
  if (applicable.length === 0) return null
  const conformes = applicable.filter((v) => v === 'Conforme').length
  return (conformes / applicable.length) * 100
}

// Regra unificada: dia >= 26 → próximo mês (igual à regra operacional)
export function competencia2524(dataStr: string): Competencia | null {
  const parts = dataStr.split('/')
  if (parts.length !== 3) return null
  const dia = parseInt(parts[0], 10)
  const mes = parseInt(parts[1], 10)
  const ano = parseInt(parts[2], 10)
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
  if (dia >= 26) {
    const d = new Date(ano, mes, 1) // mes is 1-based → 1st of next month
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  }
  return { mes, ano }
}

export function competenciaAtual2524(): Competencia {
  const hoje = new Date()
  const dia = hoje.getDate()
  if (dia >= 26) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  }
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
}

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

// INDE04 e INDE07 são avaliados juntos na planilha — agregados sob uma chave combinada
const INDE_MERGE: Record<string, string> = {
  INDE04: INDE_MERGE_KEY,
  INDE07: INDE_MERGE_KEY,
}

type AccEntry = { displayName: string; Cozinha: number[]; Bar: number[]; Atendimento: number[]; count: number }

export function processSheetData(rows: string[][], comp: Competencia): NotaOperacao[] {
  const dataRows = rows.slice(1) // skip header

  const filtered = dataRows.filter((row) => {
    const dataVisita = row[1]
    if (!dataVisita) return false
    const c = competencia2524(dataVisita)
    if (!c) return false
    return c.mes === comp.mes && c.ano === comp.ano
  })

  const byKey: Record<string, AccEntry> = {}

  for (const row of filtered) {
    const rawNome = row[2]?.trim()
    if (!rawNome) continue

    const codeMatch = rawNome.match(/INDE\d+/i)
    const code = codeMatch ? codeMatch[0].toUpperCase() : null
    // Use merged name for INDE04/07, otherwise group by code or raw name
    const key = (code && INDE_MERGE[code]) ?? code ?? rawNome
    const displayName = (code && INDE_MERGE[code]) ?? rawNome

    if (!byKey[key])
      byKey[key] = { displayName, Cozinha: [], Bar: [], Atendimento: [], count: 0 }

    byKey[key].count++

    for (const [area, { start, end }] of Object.entries(AREAS) as [AreaKey, { start: number; end: number }][]) {
      const score = scoreArea(row, start, end)
      if (score !== null) byKey[key][area].push(score)
    }
  }

  return Object.entries(byKey)
    .map(([, entry]) => {
      const Cozinha = avg(entry.Cozinha)
      const Bar = avg(entry.Bar)
      const Atendimento = avg(entry.Atendimento)
      const validas = [Cozinha, Bar, Atendimento].filter((n): n is number => n !== null)
      const consolidado = validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : null
      return { unidade: entry.displayName, Cozinha, Bar, Atendimento, consolidado, visitas: entry.count }
    })
    .sort((a, b) => a.unidade.localeCompare(b.unidade))
}

export function notaRede2524(rows: NotaOperacao[]): number | null {
  const validas = rows.map((r) => r.consolidado).filter((n): n is number => n !== null)
  return validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : null
}

export type ValorNutriSheet = 'Conforme' | 'Nao_Conforme' | 'Nao_Aplicavel'

export interface ItemVisitaNutri {
  area: AreaKey
  descricao: string
  valor: ValorNutriSheet
}

export interface VisitaNutri {
  data: string
  displayNome: string
}

export interface VisitaNutriDetalhe extends VisitaNutri {
  itens: ItemVisitaNutri[]
}

function parseValorSheet(raw: string): ValorNutriSheet | null {
  const v = raw.trim().toLowerCase()
  if (v === 'conforme') return 'Conforme'
  if (v.startsWith('não conf') || v.startsWith('nao conf')) return 'Nao_Conforme'
  if (v === 'não aplicável' || v === 'não aplicavel' || v === 'na' || v === 'n/a' || v === 'nao aplicavel' || v === 'nao_aplicavel') return 'Nao_Aplicavel'
  return null
}

export function processVisitasNutri(rows: string[][], comp: Competencia): VisitaNutriDetalhe[] {
  if (rows.length < 2) return []
  const headers = rows[0]
  const dataRows = rows.slice(1)

  const filtered = dataRows.filter((row) => {
    const dataVisita = row[1]
    if (!dataVisita) return false
    const c = competencia2524(dataVisita)
    if (!c) return false
    return c.mes === comp.mes && c.ano === comp.ano
  })

  return filtered.map((row) => {
    const rawNome = row[2]?.trim() ?? ''
    const codeMatch = rawNome.match(/INDE\d+/i)
    const code = codeMatch ? codeMatch[0].toUpperCase() : null
    const displayNome = (code && INDE_MERGE[code]) ?? rawNome

    const itens: ItemVisitaNutri[] = []
    for (const [area, { start, end }] of Object.entries(AREAS) as [AreaKey, { start: number; end: number }][]) {
      for (let col = start; col <= end; col++) {
        const descricao = headers[col]?.trim()
        if (!descricao) continue
        const valor = parseValorSheet(row[col] ?? '')
        if (!valor) continue
        itens.push({ area, descricao, valor })
      }
    }

    return { data: row[1], displayNome, itens }
  })
}
