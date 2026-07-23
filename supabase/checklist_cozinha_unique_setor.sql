-- ============================================================
-- Corrige a unicidade do checklist diário: incluir o SETOR.
--
-- Problema: a unicidade era (unidade_id, tipo, data_operacao) SEM setor,
-- então o 1º setor (ex.: Cozinha) que preenchia "abertura" de uma unidade
-- num dia BLOQUEAVA os demais setores (Bar, Atendimento) da mesma unidade
-- ("alguém já preencheu"). Cada setor deve ter o seu próprio checklist.
--
-- Rodar no SQL Editor do Supabase. Idempotente e seguro:
--  - só remove a unicidade antiga (que NÃO tem setor);
--  - relaxar a regra não pode violar dados existentes.
-- ============================================================

-- ─── 0) DIAGNÓSTICO (rode isto sozinho antes, se quiser conferir) ──
-- SELECT conname, pg_get_constraintdef(oid) AS definicao
-- FROM pg_constraint
-- WHERE conrelid = 'checklist_cozinha'::regclass AND contype IN ('u','p');

-- ─── 1) Remove a unicidade antiga sem setor (constraint) ──────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'checklist_cozinha'::regclass
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) ILIKE '%unidade_id%'
      AND pg_get_constraintdef(con.oid) ILIKE '%tipo%'
      AND pg_get_constraintdef(con.oid) ILIKE '%data_operacao%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%setor%'
  LOOP
    EXECUTE format('ALTER TABLE checklist_cozinha DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ─── 2) Remove índice único avulso sem setor (caso exista) ────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'checklist_cozinha'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%unidade_id%'
      AND indexdef ILIKE '%tipo%'
      AND indexdef ILIKE '%data_operacao%'
      AND indexdef NOT ILIKE '%setor%'
      AND indexname NOT IN (
        SELECT conname FROM pg_constraint WHERE conrelid = 'checklist_cozinha'::regclass
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

-- ─── 3) Cria a nova unicidade INCLUINDO setor (se ainda não existir) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'checklist_cozinha'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%unidade_id%'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
      AND pg_get_constraintdef(oid) ILIKE '%data_operacao%'
      AND pg_get_constraintdef(oid) ILIKE '%setor%'
  ) THEN
    ALTER TABLE checklist_cozinha
      ADD CONSTRAINT checklist_cozinha_unidade_tipo_data_setor_key
      UNIQUE (unidade_id, tipo, data_operacao, setor);
  END IF;
END $$;

-- ─── 4) Conferência (deve mostrar a unicidade com setor) ──────────
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'checklist_cozinha'::regclass AND contype = 'u';
