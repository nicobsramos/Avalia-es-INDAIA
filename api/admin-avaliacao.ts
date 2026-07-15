/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL  = 'n.ramos.indaia@gmail.com'
const JULIA_EMAIL  = 'nutrijuliamafra@gmail.com'

async function getCaller(req: any, admin: any): Promise<{ email: string; id: string } | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return null
  return { email: user.email ?? '', id: user.id }
}

const ALLOWED_OP   = ['data_visita', 'competencia_mes', 'competencia_ano', 'respostas']
const ALLOWED_NUTRI = [
  'data_visita', 'competencia_mes', 'competencia_ano',
  'lideres_presentes', 'obs_cozinha', 'obs_bar', 'obs_atendimento', 'relatorio_tecnico',
]

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Configuração ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const caller = await getCaller(req, admin)
  const callerEmail = caller?.email ?? null
  const { tipo, id } = req.query as Record<string, string>

  if (!id || (tipo !== 'operacional' && tipo !== 'nutri'))
    return res.status(400).json({ error: 'Parâmetros inválidos' })

  // Fetch caller role
  let callerRole: string | null = null
  if (caller?.id) {
    const { data } = await (admin as any).from('usuarios').select('role').eq('id', caller.id).single()
    callerRole = data?.role ?? null
  }

  const isAdmin      = callerEmail === ADMIN_EMAIL
  const isJuliaNutri = callerEmail === JULIA_EMAIL && tipo === 'nutri'
  const isRedeOp     = callerRole === 'rede' && tipo === 'operacional'
  const hasBaseAccess = isAdmin || isJuliaNutri || isRedeOp

  const tabela          = tipo === 'operacional' ? 'avaliacoes'           : 'nutri_avaliacoes'
  const tabelaRespostas = tipo === 'operacional' ? 'avaliacao_respostas'  : 'nutri_respostas'

  // ── DELETE ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    // Fetch the evaluation to check ownership
    const { data: evalData } = await (admin as any).from(tabela).select('usuario_id').eq('id', id).single()

    // Non-leitura users may delete evaluations they themselves created
    const isOwner = !!caller && callerRole !== null && callerRole !== 'leitura'
      && evalData?.usuario_id === caller.id

    if (!hasBaseAccess && !isOwner) return res.status(403).json({ error: 'Acesso negado' })

    await (admin as any).from(tabelaRespostas).delete().eq('avaliacao_id', id)
    const { error } = await (admin as any).from(tabela).delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  // ── PATCH (edit) — admin / rede / julia OR owner ────────────────────────────
  if (req.method === 'PATCH') {
    const { data: evalData } = await (admin as any).from(tabela).select('usuario_id').eq('id', id).single()
    const isOwner = !!caller && callerRole !== null && callerRole !== 'leitura'
      && evalData?.usuario_id === caller.id
    if (!hasBaseAccess && !isOwner) return res.status(403).json({ error: 'Acesso negado' })

    const fields  = req.body ?? {}
    const allowed = tipo === 'operacional' ? ALLOWED_OP : ALLOWED_NUTRI
    const update: Record<string, any> = {}
    for (const k of allowed) {
      if (k in fields) update[k] = fields[k] === '' ? null : fields[k]
    }
    if (Object.keys(update).length === 0)
      return res.status(400).json({ error: 'Nenhum campo válido' })

    const respostas = update.respostas
    delete update.respostas
    if (Object.keys(update).length > 0) {
      const { error } = await (admin as any).from(tabela).update(update).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
    }

    if (tipo === 'operacional' && Array.isArray(respostas)) {
      for (const r of respostas as { item_id: string; valor: number; observacao: string }[]) {
        if (!r.item_id || !r.valor) continue
        await (admin as any)
          .from(tabelaRespostas)
          .update({ valor: r.valor, observacao: r.observacao || null })
          .eq('avaliacao_id', id)
          .eq('item_id', r.item_id)
      }
    }

    return res.json({ ok: true })
  }

  return res.status(405).end()
}
