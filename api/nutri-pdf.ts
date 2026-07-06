/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const JULIA_EMAIL = 'nutrijuliamafra@gmail.com'
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
  if (callerEmail !== JULIA_EMAIL && callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })

  if (req.method === 'PATCH') {
    const { avaliacaoId, pdfUrl } = req.body ?? {}
    if (!avaliacaoId || !pdfUrl) return res.status(400).json({ error: 'avaliacaoId e pdfUrl são obrigatórios' })

    const { error } = await (admin as any)
      .from('nutri_avaliacoes')
      .update({ relatorio_pdf_url: pdfUrl })
      .eq('id', avaliacaoId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { avaliacaoId } = req.body ?? {}
    if (!avaliacaoId) return res.status(400).json({ error: 'avaliacaoId é obrigatório' })

    await (admin as any).storage.from('nutri-relatorios').remove([`${avaliacaoId}.pdf`])

    const { error } = await (admin as any)
      .from('nutri_avaliacoes')
      .update({ relatorio_pdf_url: null })
      .eq('id', avaliacaoId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
