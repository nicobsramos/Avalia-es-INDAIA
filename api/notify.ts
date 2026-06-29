/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

interface NotifyBody {
  tipo: 'operacional' | 'nutri'
  unidade: string
  usuario_nome: string
  data_visita: string
  competencia: string
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tipo, unidade, usuario_nome, data_visita, competencia } = req.body as NotifyBody

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFY_FROM_EMAIL

  if (!supabaseUrl || !serviceKey || !resendKey || !fromEmail) {
    console.warn('notify: env vars ausentes, e-mail não enviado')
    return res.json({ sent: 0, skipped: true })
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: usuarios } = await admin
      .from('usuarios')
      .select('id')
      .eq('ativo', true)

    const activeIds = new Set(((usuarios ?? []) as { id: string }[]).map((u) => u.id))

    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 200 })
    const emails = (authData?.users ?? [])
      .filter((u: any) => activeIds.has(u.id) && u.email)
      .map((u: any) => u.email as string)

    if (emails.length === 0) return res.json({ sent: 0 })

    const tipoLabel = tipo === 'operacional' ? 'Avaliação Operacional' : 'Seg. Alimentar & 5S'

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:18px">Grupo Indaiá — Nova avaliação registrada</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;color:#6b7280;font-size:14px;width:140px">Tipo</td>
              <td style="padding:10px 0;font-weight:600;font-size:14px">${tipoLabel}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Unidade</td>
              <td style="padding:10px 0;font-weight:600;font-size:14px">${unidade}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Competência</td>
              <td style="padding:10px 0;font-size:14px">${competencia}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Data da visita</td>
              <td style="padding:10px 0;font-size:14px">${data_visita}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280;font-size:14px">Registrado por</td>
              <td style="padding:10px 0;font-size:14px">${usuario_nome || '—'}</td>
            </tr>
          </table>
        </div>
      </div>
    `

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: emails,
        subject: `Nova ${tipoLabel} — ${unidade} (${competencia})`,
        html,
      }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json()
      console.error('Resend error:', err)
      return res.status(500).json({ error: 'Resend error' })
    }

    return res.json({ sent: emails.length })
  } catch (err) {
    console.error('notify error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
