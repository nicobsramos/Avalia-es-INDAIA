/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'
const GESTORES_CHECKLIST = new Set([ADMIN_EMAIL, 'flaviavo05@gmail.com', 'laisalves.indaia@gmail.com', 'k.guatelli.indaia@gmail.com', 'g.bueno.indaia@gmail.com'])

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Configuração ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' })
  const token = auth.slice(7)
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await (admin as any)
    .from('usuarios')
    .select('ver_tudo, role')
    .eq('id', user.id)
    .single()

  const { id } = req.query as Record<string, string>
  if (!id) return res.status(400).json({ error: 'ID obrigatório' })

  const isAdmin = GESTORES_CHECKLIST.has(user.email ?? '') || perfil?.ver_tudo === true

  // Não-admin: só pode apagar checklist que ele mesmo criou (e não é role leitura)
  if (!isAdmin) {
    const { data: ck } = await (admin as any)
      .from('checklist_cozinha')
      .select('usuario_id')
      .eq('id', id)
      .single()
    const isOwner = !!ck && ck.usuario_id === user.id && perfil?.role !== 'leitura'
    if (!isOwner) return res.status(403).json({ error: 'Acesso negado' })
  }

  await (admin as any).from('checklist_cozinha_respostas').delete().eq('checklist_id', id)
  const { error } = await (admin as any).from('checklist_cozinha').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}
