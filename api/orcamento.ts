// Proxy para as abas de orçamento (planilha "IMPORT - ORÇAMENTO 2026 OPERAÇÃO").
// Busca por NOME da aba (não por gid) porque o Apps Script de sincronização
// apaga e recria as abas todo dia às 6h — o gid muda a cada execução, o nome não.
const SPREADSHEET_ID = '1gZzHQdtpRpzgJh0QKN_aZubpNyPt6Mmh4UOcG7KFKeU'

export default async function handler(req: any, res: any) {
  const sheet = typeof req.query?.sheet === 'string' ? req.query.sheet : ''
  if (!sheet) {
    res.status(400).send('Parâmetro "sheet" é obrigatório')
    return
  }

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      res.status(502).send('Não foi possível buscar a aba solicitada (verifique se o link de compartilhamento está como "Qualquer pessoa com o link")')
      return
    }
    const text = await response.text()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).send(text)
  } catch {
    res.status(500).send('Erro ao buscar dados da planilha de orçamento')
  }
}
