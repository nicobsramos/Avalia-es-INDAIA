-- ============================================================
-- CHECKLIST DIÁRIO DE COZINHA
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona coluna de dias de operação por semana em unidades
ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS dias_operacao_semana int NOT NULL DEFAULT 6;

-- Ajuste manual: Nova Veneza opera 5 dias/semana
-- UPDATE unidades SET dias_operacao_semana = 5 WHERE nome ILIKE '%nova veneza%';

-- ============================================================
-- 2. TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS checklist_cozinha_itens (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo      text    NOT NULL CHECK (tipo IN ('abertura', 'fechamento')),
  secao     text    NOT NULL,
  descricao text    NOT NULL,
  ordem     int     NOT NULL,
  ativo     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS checklist_cozinha (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid        REFERENCES auth.users(id) NOT NULL,
  unidade_id      uuid        REFERENCES unidades(id)   NOT NULL,
  tipo            text        NOT NULL CHECK (tipo IN ('abertura', 'fechamento')),
  data_operacao   date        NOT NULL,
  responsavel     text        NOT NULL,
  obs_gerais      text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, tipo, data_operacao)
);

CREATE TABLE IF NOT EXISTS checklist_cozinha_respostas (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid    REFERENCES checklist_cozinha(id) ON DELETE CASCADE NOT NULL,
  item_id      uuid    REFERENCES checklist_cozinha_itens(id)              NOT NULL,
  feito        boolean NOT NULL DEFAULT false,
  observacao   text,
  UNIQUE(checklist_id, item_id)
);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE checklist_cozinha_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_cozinha           ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_cozinha_respostas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. POLICIES
-- ============================================================

CREATE POLICY "checklist_cozinha_itens_select"
  ON checklist_cozinha_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_cozinha_select"
  ON checklist_cozinha FOR SELECT TO authenticated
  USING (pode_ver_unidade(unidade_id));

CREATE POLICY "checklist_cozinha_insert"
  ON checklist_cozinha FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id AND pode_ver_unidade(unidade_id));

CREATE POLICY "checklist_cozinha_update"
  ON checklist_cozinha FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "checklist_cozinha_respostas_select"
  ON checklist_cozinha_respostas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_cozinha c
    WHERE c.id = checklist_id AND pode_ver_unidade(c.unidade_id)
  ));

CREATE POLICY "checklist_cozinha_respostas_insert"
  ON checklist_cozinha_respostas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM checklist_cozinha c
    WHERE c.id = checklist_id AND c.usuario_id = auth.uid()
  ));

CREATE POLICY "checklist_cozinha_respostas_update"
  ON checklist_cozinha_respostas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_cozinha c
    WHERE c.id = checklist_id AND c.usuario_id = auth.uid()
  ));

-- ============================================================
-- 5. ITENS (seed)
-- ============================================================

INSERT INTO checklist_cozinha_itens (tipo, secao, descricao, ordem) VALUES
-- ABERTURA
('abertura', 'Equipe e Organização do Turno', 'Realizar reunião rápida de alinhamento com a equipe antes do início das atividades.', 1),
('abertura', 'Equipe e Organização do Turno', 'Conferir a escala e a distribuição das funções da equipe no turno.', 2),
('abertura', 'Equipe e Organização do Turno', 'Verificar se todos os colaboradores estão aptos ao trabalho (sem sintomas de doenças, cortes ou lesões expostas).', 3),
('abertura', 'Equipe e Organização do Turno', 'Verificar o uniforme dos funcionários (limpo, completo e em bom estado).', 4),
('abertura', 'Equipe e Organização do Turno', 'Verificar higiene pessoal, uso de adornos, unhas e barbas.', 5),
('abertura', 'Equipe e Organização do Turno', 'Conferir o uso correto de EPIs (luvas, touca, máscara) conforme a função.', 6),
('abertura', 'Higiene e Insumos', 'Verificar se a pia de lavagem das mãos está abastecida com sabonete inodoro e papel-toalha.', 7),
('abertura', 'Higiene e Insumos', 'Verificar a disponibilidade de álcool 70% para higienização.', 8),
('abertura', 'Higiene e Insumos', 'Verificar a higiene das bancadas, pias e superfícies de apoio.', 9),
('abertura', 'Higiene e Insumos', 'Verificar a higiene do piso e ralos da área de produção.', 10),
('abertura', 'Higiene e Insumos', 'Repor potes, dispensers e materiais de higienização.', 11),
('abertura', 'Higiene e Insumos', 'Conferir a disponibilidade de panos e perfex limpos para o turno.', 12),
('abertura', 'Alimentos e Temperatura', 'Verificar o descongelamento correto dos alimentos congelados.', 13),
('abertura', 'Alimentos e Temperatura', 'Medir e registrar a temperatura das câmaras frias e freezers.', 14),
('abertura', 'Alimentos e Temperatura', 'Verificar se os alimentos armazenados estão identificados, etiquetados e dentro da validade.', 15),
('abertura', 'Alimentos e Temperatura', 'Conferir se não há sobras do turno anterior sem identificação ou fora do padrão.', 16),
('abertura', 'Equipamentos', 'Verificar o funcionamento correto de fogões, fornos, chapas e demais equipamentos.', 17),
('abertura', 'Equipamentos', 'Conferir a limpeza dos equipamentos antes do início do uso.', 18),
('abertura', 'Equipamentos', 'Verificar o estado de conservação de utensílios e equipamentos (sem ferrugem, trincas ou danos).', 19),
('abertura', 'Produção e Mise en Place', 'Organizar praças com os utensílios necessários (perfex, bowls, formas, etc.).', 20),
('abertura', 'Produção e Mise en Place', 'Verificar se as colheres de prova estão disponíveis e identificadas por uso.', 21),
('abertura', 'Produção e Mise en Place', 'Conferir o mise en place das praças conforme o cardápio do dia.', 22),
('abertura', 'Produção e Mise en Place', 'Conferir o cardápio e a quantidade de produção prevista para o evento/turno.', 23),
-- FECHAMENTO
('fechamento', 'Alimentos e Armazenamento', 'Verificar se todas as produções estão devidamente identificadas, etiquetadas e dentro da validade.', 1),
('fechamento', 'Alimentos e Armazenamento', 'Verificar a organização das câmaras, geladeiras e freezers.', 2),
('fechamento', 'Alimentos e Armazenamento', 'Garantir que todos os alimentos estejam protegidos e cobertos.', 3),
('fechamento', 'Alimentos e Armazenamento', 'Verificar se não há alimentos fora da temperatura adequada.', 4),
('fechamento', 'Alimentos e Armazenamento', 'Realizar o descarte de produtos vencidos ou impróprios para consumo.', 5),
('fechamento', 'Alimentos e Armazenamento', 'Organizar o estoque seco, refrigerado e congelado.', 6),
('fechamento', 'Alimentos e Armazenamento', 'Separar e sinalizar produtos com avarias ou pendências.', 7),
('fechamento', 'Alimentos e Armazenamento', 'Garantir que alimentos prontos não fiquem expostos sem proteção durante o armazenamento.', 8),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Higienizar bancadas, mesas e superfícies de trabalho.', 9),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Higienizar utensílios, equipamentos e ferramentas de produção.', 10),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Limpar fogões, chapas, fornos e fritadeiras, incluindo partes internas e traseiras.', 11),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Filtrar ou descartar o óleo das fritadeiras, conforme procedimento.', 12),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Esvaziar, higienizar e reorganizar cubas e recipientes.', 13),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Higienizar liquidificadores, processadores e demais equipamentos elétricos.', 14),
('fechamento', 'Limpeza de Equipamentos e Superfícies', 'Repor utensílios em seus locais de armazenamento, devidamente identificados.', 15),
('fechamento', 'Limpeza do Ambiente', 'Remover resíduos e realizar a limpeza das lixeiras.', 16),
('fechamento', 'Limpeza do Ambiente', 'Verificar o correto acondicionamento do lixo para coleta.', 17),
('fechamento', 'Limpeza do Ambiente', 'Higienizar pisos, ralos e áreas de circulação.', 18),
('fechamento', 'Limpeza do Ambiente', 'Higienizar paredes, portas e maçanetas da área de produção.', 19),
('fechamento', 'Limpeza do Ambiente', 'Conferir a limpeza das câmaras frias e freezers (interna e externa).', 20),
('fechamento', 'Equipamentos e Segurança', 'Verificar se portas de câmaras, freezers e equipamentos estão devidamente fechadas.', 21),
('fechamento', 'Equipamentos e Segurança', 'Registrar as temperaturas dos equipamentos de refrigeração.', 22),
('fechamento', 'Equipamentos e Segurança', 'Conferir o desligamento dos equipamentos que não precisam permanecer ligados.', 23),
('fechamento', 'Equipamentos e Segurança', 'Verificar o fechamento dos registros de gás, quando aplicável.', 24),
('fechamento', 'Equipamentos e Segurança', 'Conferir o desligamento de luzes e demais pontos de energia não essenciais.', 25),
('fechamento', 'Preparação para o Próximo Turno', 'Conferir o abastecimento de sabonete inodoro, papel-toalha e álcool 70% para o turno seguinte.', 26),
('fechamento', 'Preparação para o Próximo Turno', 'Repor materiais de limpeza e higienização para o próximo turno.', 27),
('fechamento', 'Preparação para o Próximo Turno', 'Registrar não conformidades identificadas durante o turno.', 28),
('fechamento', 'Preparação para o Próximo Turno', 'Informar à liderança necessidades de manutenção ou reposição de materiais.', 29),
('fechamento', 'Preparação para o Próximo Turno', 'Realizar inspeção visual final da cozinha, garantindo limpeza, organização e conformidade para a abertura do próximo turno.', 30),
('fechamento', 'Preparação para o Próximo Turno', 'Trancar acessos e verificar a segurança do ambiente antes da saída da equipe.', 31);
