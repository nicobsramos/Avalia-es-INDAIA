# Indaiá — Sistema de Avaliação de Unidades

## Requisitos

- Node.js 18+
- Conta no Supabase com o schema já configurado

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Copie o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```

3. Edite o `.env` com os dados do seu projeto Supabase:
   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```
   > Use somente a **anon key** — nunca a service_role key no frontend.

## Executar

```bash
npm run dev
```

Acesse `http://localhost:5173`.

## Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
├── lib/supabase.ts          # cliente Supabase singleton
├── types/index.ts           # tipos TypeScript do schema
├── context/
│   ├── AuthContext.tsx      # sessão, perfil, troca de senha
│   └── CompetenciaContext.tsx
├── hooks/
│   ├── useDashboard.ts      # dados do dashboard por competência
│   ├── useAvaliacoes.ts     # lista e detalhe de avaliações
│   └── useChecklist.ts      # setores + itens + unidades
├── utils/notas.ts           # cálculo de notas, competência 26→25, formatação
├── components/              # Layout, Sidebar, ColoredScore, etc.
└── pages/
    ├── Login.tsx
    ├── TrocaSenha.tsx
    ├── Dashboard.tsx
    └── Avaliacoes/
        ├── index.tsx        # lista
        ├── NovaAvaliacao.tsx
        └── DetalheAvaliacao.tsx
```

## Regras de competência (26→25)

Visita no dia ≥ 26 → competência = mês seguinte. Visita ≤ 25 → mês atual.
Implementado em `src/utils/notas.ts → calcularCompetencia()`.

## Faixas de cor

| Nota       | Cor     |
|------------|---------|
| ≥ 85%      | Verde   |
| 70–84,9%   | Laranja |
| < 70%      | Vermelho|
