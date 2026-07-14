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

  const { header, rows } = data

  return (
    <div className="overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm max-h-[70vh]">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 border-b border-gray-200 whitespace-nowrap ${
                  i === 0 ? 'sticky left-0 z-20 bg-gray-50' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const destaque = ehLinhaDestaque(row[0] ?? '')
            return (
              <tr
                key={ri}
                className={`border-b border-gray-100 ${destaque ? 'bg-brand-50/60' : ri % 2 === 1 ? 'bg-gray-50/50' : ''}`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 whitespace-nowrap ${destaque ? 'font-semibold text-gray-900' : 'text-gray-700'} ${
                      ci === 0 ? 'sticky left-0 z-10 bg-inherit' : ''
                    } ${ci > 0 && pareceNumero(cell) ? 'text-right tabular-nums' : ''}`}
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
