import { useState } from 'react'
import { useOrcamento, ABA_GERAL, UNIDADES_ORCAMENTO } from '../../hooks/useOrcamento'
import { LoadingSpinner, EmptyState } from '../../components/LoadingSpinner'

type Modo = 'geral' | 'unidade'

// Linhas que recebem destaque (negrito + fundo) na tabela, independente da unidade.
const LINHAS_DESTAQUE = ['faturamento', 'desp. operacionais', 'despesas administrativas', 'cmo', 'resultado']

function ehLinhaDestaque(label: string): boolean {
  const norm = label.trim().toLowerCase()
  return LINHAS_DESTAQUE.some((k) => norm === k || norm.startsWith(k))
}

function pareceNumero(valor: string): boolean {
  if (!valor) return false
  return /^-?[\d.,%\s]+$/.test(valor.trim()) && /\d/.test(valor)
}

function TabelaOrcamento({ aba }: { aba: string }) {
  const { data, isLoading, error } = useOrcamento(aba)

  if (isLoading) return <LoadingSpinner text="Carregando orçamento..." />

  if (error) {
    return (
      <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">
        Não foi possível carregar esta aba. Confirme se a planilha está compartilhada como
        "Qualquer pessoa com o link" e se o nome da aba não mudou.
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return <EmptyState text="Sem dados para exibir nesta aba." />
  }

  const isGeral = aba === ABA_GERAL
  const maxDataRows = isGeral ? 49 : 48   // planilha: linha 50 (geral) ou 49 (INDE)
  const maxCols    = isGeral ? 16 : 19   // coluna P (geral) ou S (INDE)

  // INDE: remove colunas B, C, D (índices 1-3) — mantém A + E em diante
  const filterCols = (row: string[]) =>
    isGeral ? row.slice(0, maxCols) : [row[0], ...row.slice(4, maxCols)]

  const header  = filterCols(data.header)
  // Linha 2 da planilha vai pro thead para ficar congelada junto com a linha 1
  const allRows = data.rows.slice(0, maxDataRows).map(filterCols)
  const subhead = allRows[0] ?? []
  const rows    = allRows.slice(1)

  // Altura fixa da linha 1 do header → usada como top da linha 2
  const ROW1_H = 33 // px  (py-2 + text-xs + border ≈ 33px)

  return (
    <div className="relative overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm max-h-[75vh]">
      <table className="text-xs border-separate border-spacing-0">
        <thead>
          {/* Linha 1 — meses */}
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                style={{ top: 0 }}
                className={`
                  px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100
                  border-b border-gray-300 whitespace-nowrap sticky
                  ${i === 0 ? 'left-0 z-[40] min-w-[180px] max-w-[220px]' : 'z-[30] min-w-[88px]'}
                `}
              >
                {h}
              </th>
            ))}
          </tr>
          {/* Linha 2 — sub-cabeçalho (Orç / Real / Var …) */}
          {subhead.length > 0 && (
            <tr>
              {subhead.map((cell, i) => (
                <th
                  key={i}
                  style={{ top: ROW1_H }}
                  className={`
                    px-3 py-1.5 text-left font-semibold text-gray-600 bg-gray-50
                    border-b border-gray-200 whitespace-nowrap sticky
                    ${i === 0 ? 'left-0 z-[40] min-w-[180px] max-w-[220px]' : 'z-[30] min-w-[88px]'}
                  `}
                >
                  {cell}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const destaque = ehLinhaDestaque(row[0] ?? '')
            const rowBg = destaque ? 'bg-brand-50' : ri % 2 === 1 ? 'bg-gray-50' : 'bg-white'
            return (
              <tr key={ri} className={rowBg}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`
                      px-3 py-1.5 whitespace-nowrap border-b border-gray-100
                      ${destaque ? 'font-semibold text-gray-900' : 'text-gray-700'}
                      ${ci === 0 ? `sticky left-0 z-[20] ${rowBg}` : ''}
                      ${ci > 0 && pareceNumero(cell) ? 'text-right tabular-nums' : ''}
                    `}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Orcamento() {
  const [modo, setModo] = useState<Modo>('geral')
  const [unidade, setUnidade] = useState(UNIDADES_ORCAMENTO[0].aba)

  const abaAtiva = modo === 'geral' ? ABA_GERAL : unidade

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Orçamento</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor Geral / Por Unidade */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
            <button
              onClick={() => setModo('geral')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                modo === 'geral' ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Geral
            </button>
            <button
              onClick={() => setModo('unidade')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                modo === 'unidade' ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Por Unidade
            </button>
          </div>

          {modo === 'unidade' && (
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {UNIDADES_ORCAMENTO.map((u) => (
                <option key={u.aba} value={u.aba}>
                  {u.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <TabelaOrcamento aba={abaAtiva} />
    </div>
  )
}
