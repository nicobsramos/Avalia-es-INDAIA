/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'n.ramos.indaia@gmail.com'
const FLAVIA_EMAIL = 'flaviavo05@gmail.com'

function toChecklistSetores(setoresAvaliacao: string[]): string[] {
  const result = new Set<string>()
  for (const s of setoresAvaliacao) {
    if (s.startsWith('Cozinha')) result.add('Cozinha')
    else if (s.startsWith('Bar')) result.add('Bar')
    else if (s.startsWith('Atendimento')) result.add('Atendimento')
  }
  return Array.from(result)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' })
  const token = auth.slice(7)
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await (admin as any)
    .from('usuarios')
    .select('ver_tudo, role, setores_avaliacao')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === ADMIN_EMAIL || perfil?.ver_tudo === true
  const isFlavia = user.email === FLAVIA_EMAIL
  const isLider = perfil?.role !== 'leitura'

  let setoresPermitidos: string[] | null
  if (isAdmin) {
    setoresPermitidos = null
  } else if (isFlavia) {
    setoresPermitidos = ['Cozinha']
  } else if (isLider) {
    setoresPermitidos = toChecklistSetores(perfil?.setores_avaliacao ?? [])
    if (setoresPermitidos.length === 0) return res.status(403).json({ error: 'Sem setor configurado' })
  } else {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  const { data: rows, error } = await (admin as any)
    .from('usuarios')
    .select('id, nome, role, ver_tudo, setores_avaliacao')
    .eq('status', 'aprovado')
    .order('nome')

  if (error) return res.status(500).json({ error: error.message })

  // Busca last_sign_in_at de todos os usuários via Auth Admin
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

  const usuarios = (rows ?? [])
    .map((u: any) => ({
      id: u.id,
      nome: u.nome,
      email: authMap[u.id]?.email ?? '',
      role: u.role as string,
      ver_tudo: u.ver_tudo ?? false,
      setores: toChecklistSetores(u.setores_avaliacao ?? []),
      ultimo_acesso: authMap[u.id]?.last_sign_in_at ?? null,
    }))
    .filter((u: any) => {
      if (!setoresPermitidos) return true
      return u.setores.some((s: string) => (setoresPermitidos as string[]).includes(s))
    })
    .sort((a: any, b: any) => {
      if (!a.ultimo_acesso && !b.ultimo_acesso) return 0
      if (!a.ultimo_acesso) return 1
      if (!b.ultimo_acesso) return -1
      return new Date(b.ultimo_acesso).getTime() - new Date(a.ultimo_acesso).getTime()
    })

  return res.json({ usuarios })
}
