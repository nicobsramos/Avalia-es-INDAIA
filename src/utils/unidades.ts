// Fonte única de verdade para nomes e metadados de unidades.
// O nome é exatamente o que está na tabela `unidades` do banco.

export const UNIDADES = [
  { nome: 'BC – Matte',             inde: 'INDE08', novaVeneza: false },
  { nome: 'Blumenau',               inde: 'INDE05', novaVeneza: false },
  { nome: 'Floripa – Canto',        inde: 'INDE03', novaVeneza: false },
  { nome: 'Floripa – Mediterrâneo', inde: 'INDE10', novaVeneza: false },
  { nome: 'Floripa – Mirante',      inde: 'INDE02', novaVeneza: false },
  { nome: 'Floripa – Solar',        inde: 'INDE09', novaVeneza: false },
  { nome: 'Itapema',                inde: 'INDE01', novaVeneza: false },
  { nome: 'Joinville',              inde: 'INDE04', novaVeneza: false },
  { nome: 'Joinville – Villa',      inde: 'INDE07', novaVeneza: false },
  { nome: 'Nova Veneza',            inde: 'INDE06', novaVeneza: true  },
] as const

export type NomeUnidade = typeof UNIDADES[number]['nome']

// INDE04 e INDE07 são agregados na planilha como uma entrada combinada
export const INDE_MERGE_KEY = 'Joinville Villa e Principal'

// Mapa: nome DB → chave de lookup na planilha (código INDE ou nome mesclado)
export const DB_TO_SHEET: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [
    u.nome,
    u.inde === 'INDE04' || u.inde === 'INDE07' ? INDE_MERGE_KEY : u.inde,
  ])
)

export function isNovaVeneza(nome: string): boolean {
  return UNIDADES.find((u) => u.nome === nome)?.novaVeneza ?? false
}

const META_OPERACIONAL: Record<string, number> = {
  'Itapema':            2,
  'Floripa – Mirante':  2,
  'Floripa – Canto':    2,
  'Joinville':          2,
  'Joinville – Villa':  2,
  'Blumenau': 2,
  'Nova Veneza':        1,
}

// Meta de visitas por mês
export function metaOperacional(nome: string): number {
  return META_OPERACIONAL[nome] ?? 0
}

const META_NUTRI: Record<string, number> = {
  'Itapema':            3,
  'Floripa – Mirante':  3,
  'Floripa – Canto':    3,
  'Joinville':          3,
  'Joinville – Villa':  3,
  'Blumenau': 3,
  'Nova Veneza':        1,
}

export function metaNutri(nome: string): number {
  return META_NUTRI[nome] ?? 0
}

// Meta de visitas por mês por setor (substitui a meta geral para setores específicos)
const META_SETOR_OP: Record<string, number> = {
  'Cozinha':                         1,
  'Cozinha - Checklist Semanal':     4,
  'Bar':                             1,
  'Bar - Dia de Evento':             2,
  'Bar - Pré Preparo':               2,
  'Atendimento - Maitres':           1,
  'Atendimento - Maitres Checklist': 4,
  'Atendimento - Pré evento':        1,
}

export function metaSetorOp(nomeSetor: string): number | null {
  return META_SETOR_OP[nomeSetor] ?? null
}
