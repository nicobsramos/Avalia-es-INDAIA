/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  // Verifica que o chamador é o admin master
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' })
  const token = auth.slice(7)
  const { data: { user: caller } } = await admin.auth.getUser(token)
  if (caller?.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })

  const { userId } = req.body as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' })
  if (userId === caller.id) return res.status(400).json({ error: 'Não é possível apagar seu próprio usuário' })

  // Remove da tabela usuarios primeiro (pode ter FKs)
  await (admin as any).from('usuarios').delete().eq('id', userId)

  // Remove da autenticação do Supabase
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
