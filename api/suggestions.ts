/* eslint-disable @typescript-eslint/no-explicit-any */

interface ItemCritico {
  descricao: string
  setor: string
  valor: 1 | 2
}

interface SugestoesBody {
  unidade: string
  competencia: string
  tipo: 'operacional' | 'nutri'
  setores: { nome: string; nota: number | null }[]
  itensCriticos?: ItemCritico[]
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { unidade, competencia, tipo, setores, itensCriticos = [] } = req.body as SugestoesBody

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada' })

  const setoresTexto = setores
    .filter((s) => s.nota !== null)
    .map((s) => `• ${s.nome}: ${s.nota!.toFixed(1)}%`)
    .join('\n')

  let prompt: string

  if (tipo === 'operacional' && itensCriticos.length > 0) {
    const itensTexto = itensCriticos
      .map((i) => `• [${i.setor}] ${i.descricao} — ${i.valor === 1 ? 'Não atende' : 'Parcial'}`)
      .join('\n')

    prompt = `Você é consultor de qualidade operacional da rede Grupo Indaiá (restaurantes).

Unidade: ${unidade} | Competência: ${competencia}

NOTAS DA AVALIAÇÃO:
${setoresTexto}

PONTOS CRÍTICOS (${itensCriticos.length} itens com nota baixa):
${itensTexto}

Forneça ao gestor da unidade sugestões práticas e objetivas para melhorar a nota. Organize por setor. Priorize os pontos mais impactantes. Linguagem direta e acionável. Máximo 250 palavras. Responda em português.`
  } else if (tipo === 'nutri' && setores.some((s) => s.nota !== null)) {
    const baixos = setores.filter((s) => s.nota !== null && s.nota < 85)

    prompt = `Você é nutricionista consultora da rede Grupo Indaiá.

Unidade: ${unidade} | Competência: ${competencia}

NOTAS DE SEG. ALIMENTAR & 5S:
${setoresTexto}

${baixos.length > 0 ? `Setores abaixo de 85%: ${baixos.map((s) => s.nome).join(', ')}.` : ''}

Com base nas notas por área, forneça sugestões práticas ao responsável da unidade para melhorar a conformidade em Segurança Alimentar e 5S. Foque nos setores com nota mais baixa. Linguagem objetiva e acionável. Máximo 200 palavras. Responda em português.`
  } else {
    return res.json({
      sugestoes: 'Nenhum dado de avaliação disponível para esta competência. Realize uma visita para obter sugestões personalizadas.',
    })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) throw new Error(`Groq ${response.status}`)
    const data = await response.json()
    const sugestoes: string = data.choices?.[0]?.message?.content ?? 'Não foi possível gerar sugestões.'

    res.setHeader('Cache-Control', 's-maxage=600')
    return res.json({ sugestoes })
  } catch (err) {
    console.error('suggestions error:', err)
    return res.status(500).json({ error: 'Erro ao gerar sugestões' })
  }
}
