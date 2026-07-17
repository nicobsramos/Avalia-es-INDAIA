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

  // ── GET: lista todos os usuários + unidades + setores disponíveis ───────────
  if (req.method === 'GET') {
    const [{ data: rows, error }, { data: unidades }, { data: setoresRows }] = await Promise.all([
      (admin as any).from('usuarios').select('id, nome, role, status, unidades_ids, setores_avaliacao, pode_nutri, pode_orcamento, cargo').order('nome'),
      (admin as any).from('unidades').select('id, nome').eq('ativo', true).order('nome'),
      (admin as any).from('setores').select('nome').order('ordem'),
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
    const authMap: Record<string, { email: string; last_sign_in_at: string | null }> = {}
    for (const u of allAuthUsers) {
      authMap[u.id] = { email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null }
    }

    return res.json({
      usuarios: (rows ?? []).map((u: any) => ({
        id: u.id,
        nome: u.nome,
        email: authMap[u.id]?.email ?? '',
        role: u.role,
        status: u.status,
        unidades_ids: u.unidades_ids ?? [],
        setores_avaliacao: u.setores_avaliacao ?? [],
        pode_nutri: u.pode_nutri ?? false,
        pode_orcamento: u.pode_orcamento ?? false,
        cargo: u.cargo ?? null,
        ultimo_acesso: authMap[u.id]?.last_sign_in_at ?? null,
      })),
      unidades: unidades ?? [],
      setores: (setoresRows ?? []).map((s: any) => s.nome),
    })
  }

  // ── PATCH: atualiza campos do usuário ────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { userId, nome, unidades_ids, role, setores_avaliacao, pode_nutri, pode_orcamento, cargo } = req.body ?? {}
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' })

    const update: Record<string, any> = {}
    if (nome?.trim())                    update.nome               = nome.trim()
    if (Array.isArray(unidades_ids))     update.unidades_ids       = unidades_ids
    if (Array.isArray(setores_avaliacao)) update.setores_avaliacao = setores_avaliacao
    if (['rede', 'lider', 'leitura'].includes(role)) update.role  = role
    if (typeof pode_nutri === 'boolean') update.pode_nutri         = pode_nutri
    if (typeof pode_orcamento === 'boolean') update.pode_orcamento = pode_orcamento
    if ('cargo' in (req.body ?? {}))     update.cargo              = cargo ?? null

    if (Object.keys(update).length === 0)
      return res.status(400).json({ error: 'Nada para atualizar' })

    const { error } = await (admin as any)
      .from('usuarios')
      .update(update)
      .eq('id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  // ── DELETE: apaga usuário do sistema ─────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { userId } = req.body ?? {}
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' })

    // Busca o caller id para impedir auto-exclusão
    const token = (req.headers['authorization'] as string).slice(7)
    const { data: { user: caller } } = await admin.auth.getUser(token)
    if (caller?.id === userId) return res.status(400).json({ error: 'Não é possível apagar seu próprio usuário' })

    await (admin as any).from('usuarios').delete().eq('id', userId)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
