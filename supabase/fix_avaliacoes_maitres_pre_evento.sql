-- ============================================================
-- CORREÇÃO PONTUAL — reclassificar 2 avaliações antigas
--
-- Essas avaliações foram feitas no formato antigo (tudo no setor
-- "Atendimento"). Reatribui as respostas para os setores atuais,
-- conforme a SEÇÃO do item:
--   • "Auditoria operacional do evento"  ->  "Atendimento - Maitres"
--   • "Pré-evento"                        ->  "Atendimento - Pré evento"
--
-- Escopo: SOMENTE as 2 avaliações abaixo. Não afeta mais nada.
-- Rodar no SQL Editor do Supabase (rode o passo 1, confira, depois 2 e 3).
-- Idempotente: pode rodar de novo sem efeito extra.
-- ============================================================

-- ─── 1) DIAGNÓSTICO (antes) ─────────────────────────────────
-- Mostra, por avaliação, quantas respostas há em cada seção e
-- em qual setor estão hoje. Use para conferir as seções existentes.
SELECT ar.avaliacao_id, ci.secao, s.nome AS setor_atual, COUNT(*) AS respostas
FROM avaliacao_respostas ar
JOIN checklist_itens ci ON ci.id = ar.item_id
JOIN setores s          ON s.id = ar.setor_id
WHERE ar.avaliacao_id IN (
  'b5e71d9d-d8f2-42f7-8656-182fd637f4a8',
  '9784714a-0d8a-490b-8041-d6fb49ad2a82'
)
GROUP BY ar.avaliacao_id, ci.secao, s.nome
ORDER BY ar.avaliacao_id, ci.secao;

-- ─── 2) UPDATES ─────────────────────────────────────────────
-- Auditoria operacional do evento  ->  Atendimento - Maitres
UPDATE avaliacao_respostas ar
SET setor_id = alvo.id
FROM checklist_itens ci, setores alvo
WHERE ci.id = ar.item_id
  AND alvo.nome = 'Atendimento - Maitres'
  AND ar.avaliacao_id IN (
    'b5e71d9d-d8f2-42f7-8656-182fd637f4a8',
    '9784714a-0d8a-490b-8041-d6fb49ad2a82'
  )
  AND ci.secao ILIKE 'Auditoria operacional%'
  AND ar.setor_id <> alvo.id;

-- Pré-evento  ->  Atendimento - Pré evento
UPDATE avaliacao_respostas ar
SET setor_id = alvo.id
FROM checklist_itens ci, setores alvo
WHERE ci.id = ar.item_id
  AND alvo.nome = 'Atendimento - Pré evento'
  AND ar.avaliacao_id IN (
    'b5e71d9d-d8f2-42f7-8656-182fd637f4a8',
    '9784714a-0d8a-490b-8041-d6fb49ad2a82'
  )
  AND ci.secao ILIKE 'Pr%evento'
  AND ar.setor_id <> alvo.id;

-- ─── 3) VERIFICAÇÃO (depois) ────────────────────────────────
-- Após rodar o passo 2, o resultado deve mostrar as respostas já
-- distribuídas entre "Atendimento - Maitres" e "Atendimento - Pré evento".
SELECT ar.avaliacao_id, s.nome AS setor, ci.secao, COUNT(*) AS respostas
FROM avaliacao_respostas ar
JOIN checklist_itens ci ON ci.id = ar.item_id
JOIN setores s          ON s.id = ar.setor_id
WHERE ar.avaliacao_id IN (
  'b5e71d9d-d8f2-42f7-8656-182fd637f4a8',
  '9784714a-0d8a-490b-8041-d6fb49ad2a82'
)
GROUP BY ar.avaliacao_id, s.nome, ci.secao
ORDER BY ar.avaliacao_id, s.nome;
