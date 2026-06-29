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

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const callerEmail = await getCallerEmail(req, admin)
  if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })

  // ── GET: lista todos os usuários + unidades disponíveis ─────────────────────
  if (req.method === 'GET') {
    const [{ data: rows, error }, { data: unidades }] = await Promise.all([
      (admin as any).from('usuarios').select('id, nome, role, status, unidades_ids').order('nome'),
      (admin as any).from('unidades').select('id, nome').eq('ativo', true).order('nome'),
    ])

    if (error) return res.status(500).json({ error: error.message })

    // Busca emails do Auth em lotes de 1000
    let allAuthUsers: any[] = []
    let page = 1
    while (true) {
      const { data: pageData } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      const users = pageData?.users ?? []
      allAuthUsers = allAuthUsers.concat(users)
      if (users.length < 1000) break
      page++
    }
    const emailMap: Record<string, string> = {}
    for (const u of allAuthUsers) emailMap[u.id] = u.email ?? ''

    return res.json({
      usuarios: (rows ?? []).map((u: any) => ({
        id: u.id,
        nome: u.nome,
        email: emailMap[u.id] ?? '',
        role: u.role,
        status: u.status,
        unidades_ids: u.unidades_ids ?? [],
      })),
      unidades: unidades ?? [],
    })
  }

  // ── PATCH: atualiza nome e/ou unidades ───────────────────────────────────────
  if (req.method === 'PATCH') {
    const { userId, nome, unidades_ids } = req.body ?? {}
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' })

    const update: Record<string, any> = {}
    if (nome?.trim()) update.nome = nome.trim()
    if (Array.isArray(unidades_ids)) update.unidades_ids = unidades_ids

    if (Object.keys(update).length === 0)
      return res.status(400).json({ error: 'Nada para atualizar' })

    const { error } = await (admin as any)
      .from('usuarios')
      .update(update)
      .eq('id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
