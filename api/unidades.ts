/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Config ausente' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data, error } = await (admin as any)
    .from('unidades')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data ?? [])
}
