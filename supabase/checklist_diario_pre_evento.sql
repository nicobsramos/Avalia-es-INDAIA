-- ============================================================
-- Checklist Diário — novo tipo "pre_evento" (Pré-evento / dia de evento)
-- Somente para o setor Atendimento.
--
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- ─── 1) Libera o novo valor no CHECK de tipo (as duas tabelas) ───
-- Remove qualquer CHECK de "tipo" existente (independente do nome) e recria.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT rel.relname AS tabela, con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname IN ('checklist_cozinha_itens', 'checklist_cozinha')
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tabela, r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE checklist_cozinha_itens
  ADD CONSTRAINT checklist_cozinha_itens_tipo_check
  CHECK (tipo IN ('abertura', 'fechamento', 'pre_evento'));

ALTER TABLE checklist_cozinha
  ADD CONSTRAINT checklist_cozinha_tipo_check
  CHECK (tipo IN ('abertura', 'fechamento', 'pre_evento'));

-- ─── 2) Itens do Pré-evento (setor Atendimento) ──────────────────
INSERT INTO checklist_cozinha_itens (tipo, secao, descricao, ordem, setor)
SELECT 'pre_evento', 'Pré-evento', v.descricao, v.ordem, 'Atendimento'
FROM (VALUES
  ('Checklist foi feito?',                                 1),
  ('Todos os itens do contrato estão disponíveis no salão?', 2),
  ('O mobiliário está limpo?',                             3),
  ('O depósito está limpo e organizado?',                  4),
  ('O mise en place está correto?',                        5)
) AS v(descricao, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM checklist_cozinha_itens ci
  WHERE ci.tipo = 'pre_evento'
    AND ci.setor = 'Atendimento'
    AND ci.descricao = v.descricao
);

-- ─── 3) Conferência ──────────────────────────────────────────────
SELECT tipo, setor, secao, ordem, descricao, ativo
FROM checklist_cozinha_itens
WHERE tipo = 'pre_evento'
ORDER BY ordem;
