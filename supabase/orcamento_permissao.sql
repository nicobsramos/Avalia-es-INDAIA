-- Permissão granular para a tela de Orçamento.
-- Rode este script uma vez no SQL Editor do Supabase (Dashboard > SQL Editor).
-- Não é aplicado automaticamente pelo projeto.

alter table usuarios
  add column if not exists pode_orcamento boolean not null default false;

-- Opcional: já libera de cara para quem você quiser (ajuste os e-mails).
-- update usuarios set pode_orcamento = true
--   where id in (select id from auth.users where email in (
--     'email-da-karina@...',
--     'email-da-lais@...',
--     'email-do-gean@...'
--   ));
