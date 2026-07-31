import type { NotaSetor } from '../types'

// Agrupamento dos setores operacionais por FUNÇÃO (papel na operação):
//   Cozinha            → setores 'Cozinha*'
//   Maitres            → 'Atendimento - Maitres*' (+ legado 'Atendimento', auditoria do evento)
//   Pré evento         → 'Atendimento - Pré evento'
//   Barman/Estoquista  → setores 'Bar*'
export type FuncaoKey = 'cozinha' | 'maitres' | 'pre_evento' | 'bar'

export const FUNCOES: { key: FuncaoKey; label: string }[] = [
  { key: 'cozinha',    label: 'Cozinha' },
  { key: 'maitres',    label: 'Maitres' },
  { key: 'pre_evento', label: 'Pré evento' },
  { key: 'bar',        label: 'Barman/Estoquista' },
]

export function funcaoDoSetor(nome: string): FuncaoKey | null {
  if (nome.startsWith('Cozinha')) return 'cozinha'
  if (nome.startsWith('Bar')) return 'bar'
  if (nome === 'Atendimento - Pré evento') return 'pre_evento'
  if (nome.startsWith('Atendimento')) return 'maitres'
  return null
}

// Índice para ordenar listas de setores pela ordem das funções
export function ordemFuncao(nome: string): number {
  const k = funcaoDoSetor(nome)
  return k ? FUNCOES.findIndex((f) => f.key === k) : FUNCOES.length
}

// Rótulos granulares são ambíguos fora de contexto ('Checklist Semanal' existe
// em Bar e Cozinha) — prefixa com o grupo: 'Bar · Checklist Semanal'.
// Setores raiz ('Cozinha', 'Bar', 'Atendimento' legado) ficam como estão.
export function rotuloComGrupo(nome: string, rotulo: string): string {
  const base = nome.startsWith('Cozinha') ? 'Cozinha'
    : nome.startsWith('Bar') ? 'Bar'
    : nome.startsWith('Atendimento') ? 'Atendimento'
    : null
  if (!base || nome === base) return rotulo
  return `${base} · ${rotulo}`
}

export interface FuncaoNotas {
  key: FuncaoKey
  label: string
  nota: number | null
  setores: NotaSetor[]
}

// Agrupa as notas de setor de UMA unidade por função.
// Nota da função = média simples dos setores com nota.
// Só retorna funções que têm ao menos um setor presente na lista.
export function agruparPorFuncao(notas: NotaSetor[]): FuncaoNotas[] {
  return FUNCOES.map(({ key, label }) => {
    const setores = notas.filter((ns) => funcaoDoSetor(ns.setor_nome) === key)
    const validas = setores.map((s) => s.nota).filter((n): n is number => n !== null)
    return {
      key,
      label,
      nota: validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : null,
      setores,
    }
  }).filter((f) => f.setores.length > 0)
}

// Resumo da rede: para cada função, média entre unidades da nota da função
// naquela unidade. Só retorna funções presentes em ao menos uma unidade.
export function resumoFuncoesRede(unidades: { notas_setores: NotaSetor[] }[]): FuncaoNotas[] {
  return FUNCOES.map(({ key, label }) => {
    let presente = false
    const notasUnidades: number[] = []
    for (const u of unidades) {
      const fs = u.notas_setores.filter((ns) => funcaoDoSetor(ns.setor_nome) === key)
      if (fs.length > 0) presente = true
      const validas = fs.map((s) => s.nota).filter((n): n is number => n !== null)
      if (validas.length) notasUnidades.push(validas.reduce((a, b) => a + b, 0) / validas.length)
    }
    if (!presente) return null
    return {
      key,
      label,
      nota: notasUnidades.length ? notasUnidades.reduce((a, b) => a + b, 0) / notasUnidades.length : null,
      setores: [] as NotaSetor[],
    }
  }).filter((f): f is FuncaoNotas => f !== null)
}
