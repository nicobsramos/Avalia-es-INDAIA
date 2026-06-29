/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

async function getCallerEmail(req: any, admin: any): Promise<string | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const { data: { user } } = await admin.auth.getUser(token)
  return user?.email ?? null
}

const ALLOWED_OP   = ['data_visita', 'competencia_mes', 'competencia_ano']
const ALLOWED_NUTRI = [
  'data_visita', 'competencia_mes', 'competencia_ano',
  'lideres_presentes', 'obs_cozinha', 'obs_bar', 'obs_atendimento', 'relatorio_tecnico',
]

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Configuração ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const callerEmail = await getCallerEmail(req, admin)
  if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })

  const { id, tipo } = req.query as Record<string, string>
  if (!id || (tipo !== 'operacional' && tipo !== 'nutri'))
    return res.status(400).json({ error: 'Parâmetros inválidos' })

  const tabela          = tipo === 'operacional' ? 'avaliacoes'       : 'nutri_avaliacoes'
  const tabelaRespostas = tipo === 'operacional' ? 'avaliacao_respostas' : 'nutri_respostas'

  // ── DELETE ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await (admin as any).from(tabelaRespostas).delete().eq('avaliacao_id', id)
    const { error } = await (admin as any).from(tabela).delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  // ── PATCH ───────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const fields   = req.body ?? {}
    const allowed  = tipo === 'operacional' ? ALLOWED_OP : ALLOWED_NUTRI
    const update: Record<string, any> = {}
    for (const k of allowed) {
      if (k in fields) update[k] = fields[k] === '' ? null : fields[k]
    }
    if (Object.keys(update).length === 0)
      return res.status(400).json({ error: 'Nenhum campo válido' })

    const { error } = await (admin as any).from(tabela).update(update).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
