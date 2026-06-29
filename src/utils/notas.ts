import type { Competencia } from '../types'

export function calcularCompetencia(dataVisita: Date): Competencia {
  const dia = dataVisita.getDate()
  if (dia >= 26) {
    const proximo = new Date(dataVisita.getFullYear(), dataVisita.getMonth() + 1, 1)
    return { mes: proximo.getMonth() + 1, ano: proximo.getFullYear() }
  }
  return { mes: dataVisita.getMonth() + 1, ano: dataVisita.getFullYear() }
}

export function competenciaAtual(): Competencia {
  return calcularCompetencia(new Date())
}

// On day 26+ the 25-24 cycle advances to the next month which has no data yet.
// Using the calendar month as default means the dashboard always opens on a cycle that has data.
export function competenciaDefaultDashboard(): Competencia {
  const hoje = new Date()
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Returns "dia 26/Jun até dia 25/Jul" for the current 25-24 competency cycle.
export function rangeCompetenciaAtual(): string {
  const c = competenciaAtual()
  const mesAnt = c.mes === 1 ? 12 : c.mes - 1
  return `dia 26/${MESES_ABREV[mesAnt - 1]} até dia 25/${MESES_ABREV[c.mes - 1]}`
}

export function competenciaAnterior(c: Competencia): Competencia {
  if (c.mes === 1) return { mes: 12, ano: c.ano - 1 }
  return { mes: c.mes - 1, ano: c.ano }
}

export function calcularNotaSetor(respostas: { valor: number }[]): number | null {
  if (respostas.length === 0) return null
  const soma = respostas.reduce((acc, r) => acc + r.valor, 0)
  return (soma / (respostas.length * 3)) * 100
}

export function calcularNotaUnidade(notasSetores: (number | null)[]): number | null {
  const validas = notasSetores.filter((n): n is number => n !== null)
  if (validas.length === 0) return null
  return validas.reduce((a, b) => a + b, 0) / validas.length
}

export function calcularNotaRede(notasUnidades: (number | null)[]): number | null {
  const validas = notasUnidades.filter((n): n is number => n !== null)
  if (validas.length === 0) return null
  return validas.reduce((a, b) => a + b, 0) / validas.length
}

export function faixaCor(nota: number | null): 'verde' | 'laranja' | 'vermelho' | 'cinza' {
  if (nota === null) return 'cinza'
  if (nota >= 85) return 'verde'
  if (nota >= 70) return 'laranja'
  return 'vermelho'
}

export function corClasse(nota: number | null): string {
  const faixa = faixaCor(nota)
  if (faixa === 'verde') return 'text-green-600'
  if (faixa === 'laranja') return 'text-orange-500'
  if (faixa === 'vermelho') return 'text-red-600'
  return 'text-gray-400'
}

export function bgCorClasse(nota: number | null): string {
  const faixa = faixaCor(nota)
  if (faixa === 'verde') return 'bg-green-50 border-green-200'
  if (faixa === 'laranja') return 'bg-orange-50 border-orange-200'
  if (faixa === 'vermelho') return 'bg-red-50 border-red-200'
  return 'bg-gray-50 border-gray-200'
}

export function formatarNota(nota: number | null): string {
  if (nota === null) return '—'
  return nota.toFixed(1) + '%'
}

export function formatarCompetencia(c: Competencia): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[c.mes - 1]}/${c.ano}`
}

export function formatarMesAno(mes: number, ano: number): string {
  return formatarCompetencia({ mes, ano })
}

export function variacaoSeta(variacao: number | null): string {
  if (variacao === null) return '→'
  if (variacao > 0.05) return '↑'
  if (variacao < -0.05) return '↓'
  return '→'
}

export function variacaoCorClasse(variacao: number | null): string {
  if (variacao === null) return 'text-gray-500'
  if (variacao > 0.05) return 'text-green-600'
  if (variacao < -0.05) return 'text-red-600'
  return 'text-gray-500'
}

export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}
