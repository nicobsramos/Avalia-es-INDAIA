-- ============================================================
-- Novas perguntas — Auditoria Operacional
-- Adiciona itens de checklist a dois setores JÁ EXISTENTES:
--   • "Atendimento - Maitres Checklist"  (tipo exibido: "Chk Maitres")
--   • "Atendimento - Pré evento"          (tipo exibido: "Pré evento")
--
-- Rodar no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez sem duplicar itens.
-- Cada bloco:
--   - resolve o setor pelo nome
--   - anexa a ordem após o último item do setor
--   - herda a seção do primeiro item do setor (mantém tudo no mesmo grupo)
-- ============================================================

-- ─── Chk Maitres  (setor: Atendimento - Maitres Checklist) ───
WITH s AS (
  SELECT id FROM setores WHERE nome = 'Atendimento - Maitres Checklist'
),
base AS (
  SELECT COALESCE(MAX(ordem), 0) AS max_ordem
  FROM checklist_itens WHERE setor_id = (SELECT id FROM s)
),
sec AS (
  SELECT secao FROM checklist_itens
  WHERE setor_id = (SELECT id FROM s)
  ORDER BY ordem LIMIT 1
)
INSERT INTO checklist_itens (setor_id, secao, descricao, ordem)
SELECT (SELECT id FROM s),
       (SELECT secao FROM sec),
       v.descricao,
       (SELECT max_ordem FROM base) + v.ord
FROM (VALUES
  ('O resumo do maître foi enviado imediatamente após o evento?', 1),
  ('Foi feito o checklist semanal?',                              2),
  ('Foi mandado no grupo a foto da equipe em dia de evento?',    3)
) AS v(descricao, ord)
WHERE EXISTS (SELECT 1 FROM s)
  AND NOT EXISTS (
    SELECT 1 FROM checklist_itens ci
    WHERE ci.setor_id = (SELECT id FROM s) AND ci.descricao = v.descricao
  );

-- ─── Pré evento  (setor: Atendimento - Pré evento) ───────────
WITH s AS (
  SELECT id FROM setores WHERE nome = 'Atendimento - Pré evento'
),
base AS (
  SELECT COALESCE(MAX(ordem), 0) AS max_ordem
  FROM checklist_itens WHERE setor_id = (SELECT id FROM s)
),
sec AS (
  SELECT secao FROM checklist_itens
  WHERE setor_id = (SELECT id FROM s)
  ORDER BY ordem LIMIT 1
)
INSERT INTO checklist_itens (setor_id, secao, descricao, ordem)
SELECT (SELECT id FROM s),
       (SELECT secao FROM sec),
       v.descricao,
       (SELECT max_ordem FROM base) + v.ord
FROM (VALUES
  ('O vídeo preventivo foi mandado no grupo?', 1)
) AS v(descricao, ord)
WHERE EXISTS (SELECT 1 FROM s)
  AND NOT EXISTS (
    SELECT 1 FROM checklist_itens ci
    WHERE ci.setor_id = (SELECT id FROM s) AND ci.descricao = v.descricao
  );

-- ─── Conferência (opcional): lista os itens dos dois setores ──
SELECT s.nome AS setor, ci.secao, ci.ordem, ci.descricao, ci.ativo
FROM checklist_itens ci
JOIN setores s ON s.id = ci.setor_id
WHERE s.nome IN ('Atendimento - Maitres Checklist', 'Atendimento - Pré evento')
ORDER BY s.nome, ci.ordem;
