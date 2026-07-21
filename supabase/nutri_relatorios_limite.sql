-- ============================================================
-- Aumenta o limite de tamanho do bucket "nutri-relatorios"
-- (PDFs de relatório da Seg. Alimentar chegam a passar de 35 MB).
--
-- Rodar no SQL Editor do Supabase.
--
-- ⚠️ IMPORTANTE: o limite EFETIVO é o MENOR entre:
--    (a) este file_size_limit do bucket, e
--    (b) o limite GLOBAL do projeto
--        (Dashboard → Project Settings → Storage → "Upload file size limit").
--    Se o global estiver menor que 100 MB, aumente-o também por lá
--    (pode exigir plano Pro, dependendo do tamanho desejado).
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 104857600   -- 100 MB, em bytes
WHERE name = 'nutri-relatorios';

-- ─── Conferência ─────────────────────────────────────────────
SELECT name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'nutri-relatorios';
