export default async function handler(_req: any, res: any) {
  try {
    const response = await fetch(
      'https://docs.google.com/spreadsheets/d/1Bkfo0-1N85Ee8epGplPvB_VUe6Ri7fjdg13fvtAOaq8/export?format=csv&gid=907174208'
    )
    const text = await response.text()
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).send(text)
  } catch {
    res.status(500).send('Erro ao buscar dados da planilha')
  }
}
