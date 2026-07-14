import { useQuery } from '@tanstack/react-query'

// Nomes exatos das abas na planilha "IMPORT - ORÇAMENTO 2026 OPERAÇÃO".
// Precisam bater 100% com os nomes reais (incluindo o travessão "—"),
// pois a busca no Google Sheets é feita pelo nome da aba.
export const ABA_GERAL = 'DRE MENSAL GERAL'

export interface UnidadeOrcamento {
  aba: string
  label: string
}

export const UNIDADES_ORCAMENTO: UnidadeOrcamento[] = [
  { aba: 'INDE01 — Itapema', label: 'Itapema' },
  { aba: 'INDE02 — Floripa (Mirante)', label: 'Floripa (Mirante)' },
  { aba: 'INDE03 — Floripa (Canto)', label: 'Floripa (Canto)' },
  { aba: 'INDE04 — Joinville (Prin)', label: 'Joinville (Prin)' },
  { aba: 'INDE05 — Blumenau', label: 'Blumenau' },
  { aba: 'INDE06 — Nova Veneza', label: 'Nova Veneza' },
  { aba: 'INDE07 — Joinville (Vila)', label: 'Joinville (Vila)' },
  { aba: 'INDE08 — BC (Matte)', label: 'BC (Matte)' },
  { aba: 'INDE09 — Floripa (Solar)', label: 'Floripa (Solar)' },
  { aba: 'INDE10 — Floripa (Mediterrâneo)', label: 'Floripa (Mediterrâneo)' },
]

export interface OrcamentoTabela {
  header: string[]
  rows: string[][]
}

// Parser CSV simples e robusto (lida com campos entre aspas, vírgulas e
// quebras de linha dentro de células, sem depender de biblioteca externa).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r') {
      // ignora, o \n cuida da quebra
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  // última célula/linha (arquivo pode não terminar com \n)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

async function fetchOrcamento(aba: string): Promise<OrcamentoTabela> {
  const resp = await fetch(`/api/orcamento?sheet=${encodeURIComponent(aba)}`)
  if (!resp.ok) throw new Error('Falha ao buscar orçamento')
  const text = await resp.text()
  const all = parseCsv(text)
  const [header = [], ...rows] = all
  return { header, rows }
}

export function useOrcamento(aba: string) {
  return useQuery({
    queryKey: ['orcamento', aba],
    queryFn: () => fetchOrcamento(aba),
    staleTime: 1000 * 60 * 5,
    enabled: !!aba,
  })
}
