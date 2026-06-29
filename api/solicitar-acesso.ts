/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nome, email, password, unidades_nomes } = req.body ?? {}
  if (!nome || !email || !password || !Array.isArray(unidades_nomes) || unidades_nomes.length === 0)
    return res.status(400).json({ error: 'Dados incompletos' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Configuração ausente' })

  const admin = createClient(supabaseUrl, serviceKey)

  // Cria usuário auth — Supabase retorna status 422 se o e-mail já existir
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr || !authData?.user) {
    const isDuplicate = (authErr as any)?.status === 422 ||
      authErr?.message?.toLowerCase().includes('already')
    if (isDuplicate) return res.status(409).json({ error: 'E-mail já cadastrado no sistema' })
    return res.status(400).json({ error: authErr?.message ?? 'Erro ao criar usuário' })
  }

  const userId = authData.user.id

  // Converte nomes de unidades para IDs do banco
  const { data: unidadesData } = await (admin as any)
    .from('unidades')
    .select('id, nome')
    .in('nome', unidades_nomes)
  const unidades_ids = ((unidadesData ?? []) as { id: string }[]).map((u) => u.id)

  // Insere na tabela usuarios com status pendente
  const { error: dbErr } = await (admin as any).from('usuarios').insert({
    id: userId,
    nome: nome.trim(),
    role: 'leitura',
    status: 'pendente',
    setores_avaliacao: [],
    pode_nutri: false,
    unidades_ids,
  })

  if (dbErr) {
    const msg: string = dbErr.message ?? ''
    const migracaoPendente = msg.includes('column') || msg.includes('does not exist') || msg.includes('status')
    // Tenta reverter criação do auth user; loga se falhar para investigação manual
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(userId)
    if (rollbackErr) console.error('[solicitar-acesso] rollback deleteUser falhou:', rollbackErr.message)
    return res.status(500).json({
      error: migracaoPendente
        ? 'O banco de dados ainda não foi configurado. O administrador precisa executar a migração SQL antes de aceitar cadastros.'
        : 'Erro ao salvar solicitação: ' + msg,
    })
  }

  return res.json({ ok: true })
}
