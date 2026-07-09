export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      unidades: {
        Row: { id: string; nome: string; ativo: boolean; criado_em: string }
        Insert: { id?: string; nome: string; ativo?: boolean; criado_em?: string }
        Update: { id?: string; nome?: string; ativo?: boolean }
      }
      setores: {
        Row: { id: string; nome: string; rotulo: string; ordem: number }
        Insert: { id?: string; nome: string; rotulo: string; ordem: number }
        Update: { id?: string; nome?: string; rotulo?: string; ordem?: number }
      }
      usuarios: {
        Row: { id: string; nome: string; role: 'rede' | 'lider' | 'leitura'; setores_avaliacao: string[]; pode_nutri: boolean; status: 'pendente' | 'ativo' | 'recusado'; unidades_ids: string[] | null; ver_tudo: boolean | null }
        Insert: { id: string; nome: string; role: 'rede' | 'lider' | 'leitura'; setores_avaliacao?: string[]; pode_nutri?: boolean; status?: 'pendente' | 'ativo' | 'recusado'; unidades_ids?: string[] | null; ver_tudo?: boolean | null }
        Update: { nome?: string; role?: 'rede' | 'lider' | 'leitura'; setores_avaliacao?: string[]; pode_nutri?: boolean; status?: 'pendente' | 'ativo' | 'recusado'; unidades_ids?: string[] | null; ver_tudo?: boolean | null }
      }
      usuario_unidade: {
        Row: { usuario_id: string; unidade_id: string }
        Insert: { usuario_id: string; unidade_id: string }
        Update: { usuario_id?: string; unidade_id?: string }
      }
      checklist_itens: {
        Row: { id: string; setor_id: string; secao: string | null; descricao: string; ordem: number; peso: number; ativo: boolean }
        Insert: { id?: string; setor_id: string; secao?: string | null; descricao: string; ordem: number; peso?: number; ativo?: boolean }
        Update: { secao?: string | null; descricao?: string; ordem?: number; peso?: number; ativo?: boolean }
      }
      avaliacoes: {
        Row: {
          id: string
          usuario_id: string
          unidade_id: string
          data_visita: string
          competencia_mes: number
          competencia_ano: number
          criado_em: string
        }
        Insert: {
          id?: string
          usuario_id: string
          unidade_id: string
          data_visita: string
          competencia_mes: number
          competencia_ano: number
          criado_em?: string
        }
        Update: {
          data_visita?: string
          competencia_mes?: number
          competencia_ano?: number
        }
      }
      avaliacao_respostas: {
        Row: {
          id: string
          avaliacao_id: string
          setor_id: string
          item_id: string
          valor: 1 | 2 | 3
          observacao: string | null
        }
        Insert: {
          id?: string
          avaliacao_id: string
          setor_id: string
          item_id: string
          valor: 1 | 2 | 3
          observacao?: string | null
        }
        Update: { valor?: 1 | 2 | 3; observacao?: string | null }
      }
    }
    Functions: {
      competencia_de: {
        Args: { d: string }
        Returns: { mes: number; ano: number }
      }
      is_rede: { Args: Record<string, never>; Returns: boolean }
      pode_ver_unidade: { Args: { p_unidade_id: string }; Returns: boolean }
    }
  }
}

export type Unidade = Database['public']['Tables']['unidades']['Row']
export type Setor = Database['public']['Tables']['setores']['Row']
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type ChecklistItem = Database['public']['Tables']['checklist_itens']['Row']
export type Avaliacao = Database['public']['Tables']['avaliacoes']['Row']
export type AvaliacaoResposta = Database['public']['Tables']['avaliacao_respostas']['Row']

export interface Competencia {
  mes: number
  ano: number
}

export interface NotaSetor {
  setor_id: string
  setor_rotulo: string
  setor_nome: string
  nota: number | null
}

export interface NotaUnidade {
  unidade_id: string
  unidade_nome: string
  nota: number | null
  notas_setores: NotaSetor[]
}

export interface RespostaItem {
  item_id: string
  setor_id: string
  valor: 1 | 2 | 3
  observacao: string
}
