/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

// Keep in sync with ADMIN_EMAIL in src/App.tsx
const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

async function getCallerEmail(req: any, admin: any): Promise<string | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const { data: { user } } = await admin.auth.getUser(token)
  return user?.email ?? null
}

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Configuração ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const callerEmail = await getCallerEmail(req, admin)
  if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })

  // ── GET: lista solicitações pendentes ─────────────────────────────────────
  if (req.method === 'GET') {
    const { data: pendentes } = await (admin as any)
      .from('usuarios')
      .select('id, nome, status, unidades_ids')
      .eq('status', 'pendente')
      .order('id')

    // Paginate through all auth users to build id→email map
    let allUsers: any[] = []
    let page = 1
    while (true) {
      const { data: pageData } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      const users = pageData?.users ?? []
      allUsers = allUsers.concat(users)
      if (users.length < 1000) break
      page++
    }
    const emailMap: Record<string, string> = {}
    for (const u of allUsers) { emailMap[u.id] = u.email ?? '' }

    const { data: unidades } = await (admin as any).from('unidades').select('id, nome')
    const unidadeMap: Record<string, string> = {}
    for (const u of (unidades ?? []) as { id: string; nome: string }[]) {
      unidadeMap[u.id] = u.nome
    }

    const result = ((pendentes ?? []) as any[]).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: emailMap[u.id] ?? '',
      unidades: ((u.unidades_ids ?? []) as string[]).map((id) => unidadeMap[id] ?? id),
    }))

    return res.json(result)
  }

  // ── POST: aprovar ou recusar ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const { userId, acao } = req.body ?? {}
    if (!userId || (acao !== 'aprovar' && acao !== 'recusar'))
      return res.status(400).json({ error: 'Dados inválidos' })

    const novoStatus = acao === 'aprovar' ? 'ativo' : 'recusado'
    const { error } = await (admin as any)
      .from('usuarios')
      .update({ status: novoStatus })
      .eq('id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
