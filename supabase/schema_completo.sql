-- ============================================================
-- SCHEMA COMPLETO — Grupo Indaiá
-- Ordem: tabelas → funções → RLS → policies → dados
-- ============================================================

-- ============================================================
-- 1. TABELAS (ordem de dependência de FK)
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text        NOT NULL,
  ativo     boolean     NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setores (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   text NOT NULL,
  rotulo text NOT NULL,
  ordem  int  NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  role text NOT NULL CHECK (role IN ('rede', 'lider'))
);

CREATE TABLE IF NOT EXISTS usuario_unidade (
  usuario_id uuid REFERENCES usuarios(id)  ON DELETE CASCADE,
  unidade_id uuid REFERENCES unidades(id)  ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, unidade_id)
);

CREATE TABLE IF NOT EXISTS checklist_itens (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id  uuid    REFERENCES setores(id) ON DELETE CASCADE NOT NULL,
  descricao text    NOT NULL,
  ordem     int     NOT NULL,
  peso      int     NOT NULL DEFAULT 1,
  ativo     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid        REFERENCES auth.users(id) NOT NULL,
  unidade_id      uuid        REFERENCES unidades(id)   NOT NULL,
  data_visita     date        NOT NULL,
  competencia_mes int         NOT NULL,
  competencia_ano int         NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avaliacao_respostas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid REFERENCES avaliacoes(id)      ON DELETE CASCADE NOT NULL,
  setor_id     uuid REFERENCES setores(id)          NOT NULL,
  item_id      uuid REFERENCES checklist_itens(id)  NOT NULL,
  valor        int  NOT NULL CHECK (valor IN (1, 2, 3)),
  observacao   text
);

CREATE TABLE IF NOT EXISTS relatorios_nutri (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid        REFERENCES unidades(id) NOT NULL,
  arquivo_path text,
  resumo_ia    text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutri_itens (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  area      text    NOT NULL CHECK (area IN ('Cozinha', 'Bar', 'Atendimento')),
  descricao text    NOT NULL,
  ordem     int     NOT NULL,
  ativo     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS nutri_avaliacoes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        uuid        REFERENCES auth.users(id) NOT NULL,
  unidade_id        uuid        REFERENCES unidades(id)   NOT NULL,
  data_visita       date        NOT NULL,
  competencia_mes   int         NOT NULL,
  competencia_ano   int         NOT NULL,
  lideres_presentes text,
  obs_cozinha       text,
  obs_bar           text,
  obs_atendimento   text,
  relatorio_tecnico text,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutri_respostas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid REFERENCES nutri_avaliacoes(id) ON DELETE CASCADE NOT NULL,
  item_id      uuid REFERENCES nutri_itens(id) NOT NULL,
  valor        text NOT NULL CHECK (valor IN ('Conforme', 'Nao_Conforme', 'Nao_Aplicavel')),
  observacao   text
);

-- ============================================================
-- 2. FUNÇÕES AUXILIARES (criadas após as tabelas que referenciam)
-- ============================================================

CREATE OR REPLACE FUNCTION is_rede()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND role = 'rede'
  );
$$;

CREATE OR REPLACE FUNCTION pode_ver_unidade(p_unidade_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_rede() OR EXISTS (
    SELECT 1 FROM usuario_unidade
    WHERE usuario_id = auth.uid() AND unidade_id = p_unidade_id
  );
$$;

CREATE OR REPLACE FUNCTION competencia_de(d date)
RETURNS TABLE(mes int, ano int)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE WHEN EXTRACT(DAY FROM d) >= 26
      THEN EXTRACT(MONTH FROM d + interval '1 month')::int
      ELSE EXTRACT(MONTH FROM d)::int
    END AS mes,
    CASE WHEN EXTRACT(DAY FROM d) >= 26
      THEN EXTRACT(YEAR FROM d + interval '1 month')::int
      ELSE EXTRACT(YEAR FROM d)::int
    END AS ano;
$$;

-- ============================================================
-- 3. ATIVAR RLS
-- ============================================================

ALTER TABLE unidades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_unidade     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios_nutri    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_avaliacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutri_respostas     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. POLICIES (criadas após funções e RLS)
-- ============================================================

CREATE POLICY "unidades_select"
  ON unidades FOR SELECT TO authenticated
  USING (pode_ver_unidade(id));

CREATE POLICY "setores_select"
  ON setores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "checklist_itens_select"
  ON checklist_itens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "usuarios_select"
  ON usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_rede());

CREATE POLICY "usuarios_insert"
  ON usuarios FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "usuario_unidade_select"
  ON usuario_unidade FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR is_rede());

CREATE POLICY "avaliacoes_select"
  ON avaliacoes FOR SELECT TO authenticated
  USING (pode_ver_unidade(unidade_id));

CREATE POLICY "avaliacoes_insert"
  ON avaliacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "respostas_select"
  ON avaliacao_respostas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM avaliacoes
    WHERE id = avaliacao_id AND pode_ver_unidade(unidade_id)
  ));

CREATE POLICY "respostas_insert"
  ON avaliacao_respostas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM avaliacoes
    WHERE id = avaliacao_id AND usuario_id = auth.uid()
  ));

CREATE POLICY "relatorios_select"
  ON relatorios_nutri FOR SELECT TO authenticated
  USING (pode_ver_unidade(unidade_id));

CREATE POLICY "nutri_itens_select"
  ON nutri_itens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "nutri_avaliacoes_select"
  ON nutri_avaliacoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "nutri_avaliacoes_insert"
  ON nutri_avaliacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "nutri_respostas_select"
  ON nutri_respostas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "nutri_respostas_insert"
  ON nutri_respostas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM nutri_avaliacoes
    WHERE id = avaliacao_id AND usuario_id = auth.uid()
  ));

-- ============================================================
-- 5. DADOS INICIAIS
-- ============================================================

INSERT INTO setores (nome, rotulo, ordem) VALUES
('Cozinha',            'Cozinha',          1),
('Bar',                'Bar',              2),
('Atendimento',        'Atendimento',      3),
('Seguranca_Alimentar','Seg. Alimentar',   4);

INSERT INTO nutri_itens (area, descricao, ordem) VALUES
('Cozinha', 'Não há insumos vencidos', 1),
('Cozinha', 'Não há itens sem identificação', 2),
('Cozinha', 'Não há utensílios em desuso', 3),
('Cozinha', 'Estoque contém apenas itens ativos', 4),
('Cozinha', 'Não há caixas vazias acumuladas', 5),
('Cozinha', 'Não há caixas de papelão no local', 6),
('Cozinha', 'Todos os itens possuem local definido', 7),
('Cozinha', 'Prateleiras estão etiquetadas e cada item possui o seu lugar definido', 8),
('Cozinha', 'Utensílios organizados por praça', 9),
('Cozinha', 'Potes e demais utensílios estão etiquetados e limpos', 10),
('Cozinha', 'Todos os itens estão etiquetados', 11),
('Cozinha', 'Produtos armazenados corretamente (etiquetados e em caixas ou potes fechados)', 12),
('Cozinha', 'Câmara fria organizada corretamente e conforme padrão', 13),
('Cozinha', 'Bancadas, paredes e piso estão limpos e secos', 14),
('Cozinha', 'Equipamentos limpos (fogão, chapa, fritadeira)', 15),
('Cozinha', 'Fritadeira possui controle de qualidade e troca de óleo', 16),
('Cozinha', 'Equipamentos, panelas, formas e bowls estão em bom estado de conservação', 17),
('Cozinha', 'Lixeiras limpas, identificadas e com abertura por pedal', 18),
('Cozinha', 'Ausência de gordura acumulada', 19),
('Cozinha', 'Câmara fria limpa e sem odor', 20),
('Cozinha', 'Há produtos de limpeza na área de manipulação?', 21),
('Cozinha', 'Uso correto de EPIs', 22),
('Cozinha', 'Etiquetas Suflex padronizadas', 23),
('Cozinha', 'POPs disponíveis e visíveis', 24),
('Cozinha', 'Checklists de abertura utilizados', 25),
('Cozinha', 'Checklists de fechamento utilizados', 26),
('Cozinha', 'Fichas técnicas disponíveis', 27),
('Cozinha', 'Equipe conhece os padrões', 28),
('Cozinha', 'Equipe acata as melhorias prontamente', 29),
('Cozinha', 'Rotina de limpeza sendo cumprida', 30),
('Cozinha', 'Não conformidades antigas resolvidas', 31),
('Cozinha', 'Líder acompanha execução', 32),
('Cozinha', 'Treinamentos realizados (caso haja colaborador sem curso de boas práticas, o líder já comunicou a nutricionista?)', 33),
('Cozinha', 'Uniformes e higiene adequados', 34),
('Cozinha', 'Temperatura de câmaras correta e planilhas de controle preenchidas', 35),
('Cozinha', 'Não há itens fora da temperatura segura', 36),
('Cozinha', 'Produtos armazenados corretamente', 37),
('Cozinha', 'Etiquetas de validade corretas', 38),
('Cozinha', 'Manipulação adequada de alimentos', 39),
('Cozinha', 'Ausência de contaminação cruzada', 40),
('Cozinha', 'Equipe faz uso correto das tábuas de corte', 41),
('Cozinha', 'Higienização correta das mãos', 42),
('Cozinha', 'Descongelamento correto', 43),
('Cozinha', 'Sanitizante para FVL está à amostra e sendo usado corretamente', 44),
('Cozinha', 'Amostras coletadas corretamente (sacos individuais, com evento, data e local)', 45),
('Cozinha', 'Equipe sem adornos, unhas curtas sem esmalte, sem cílios postiços, barbas bem feitas', 46),

('Bar', 'Não há insumos vencidos', 1),
('Bar', 'Não há itens sem identificação', 2),
('Bar', 'Não há utensílios em desuso', 3),
('Bar', 'Estoque contém apenas itens ativos', 4),
('Bar', 'Não há caixas vazias acumuladas', 5),
('Bar', 'Não há caixas de papelão no local', 6),
('Bar', 'Todos os itens possuem local definido', 7),
('Bar', 'Prateleiras estão etiquetadas e cada item possui o seu lugar definido', 8),
('Bar', 'Utensílios e equipamentos do bar organizados por estação', 9),
('Bar', 'Potes e demais utensílios estão etiquetados e limpos', 10),
('Bar', 'Todos os itens estão etiquetados', 11),
('Bar', 'Produtos armazenados corretamente (etiquetados e em recipientes fechados)', 12),
('Bar', 'Bancadas, paredes e piso estão limpos e secos', 13),
('Bar', 'Equipamentos do bar limpos (batedeiras, máquinas, dosadores)', 14),
('Bar', 'Equipamentos e utensílios em bom estado de conservação', 15),
('Bar', 'Lixeiras limpas, identificadas e com abertura por pedal', 16),
('Bar', 'Ausência de resíduos e acúmulo de sujeira', 17),
('Bar', 'Há produtos de limpeza na área de manipulação/preparo?', 18),
('Bar', 'Uso correto de EPIs', 19),
('Bar', 'Etiquetas Suflex padronizadas', 20),
('Bar', 'POPs disponíveis e visíveis', 21),
('Bar', 'Checklists de abertura utilizados', 22),
('Bar', 'Checklists de fechamento utilizados', 23),
('Bar', 'Fichas técnicas disponíveis', 24),
('Bar', 'Equipe conhece os padrões', 25),
('Bar', 'Equipe acata as melhorias prontamente', 26),
('Bar', 'Rotina de limpeza sendo cumprida', 27),
('Bar', 'Não conformidades antigas resolvidas', 28),
('Bar', 'Líder acompanha execução', 29),
('Bar', 'Treinamentos realizados (caso haja colaborador sem curso de boas práticas, o líder já comunicou a nutricionista?)', 30),
('Bar', 'Uniformes e higiene adequados', 31),
('Bar', 'Produtos perecíveis armazenados em temperatura correta', 32),
('Bar', 'Etiquetas de validade corretas em todos os produtos', 33),
('Bar', 'Não há itens vencidos ou fora da temperatura segura', 34),
('Bar', 'Ausência de contaminação cruzada', 35),
('Bar', 'Higienização correta das mãos', 36),
('Bar', 'Equipe sem adornos, unhas curtas sem esmalte, sem cílios postiços, barbas bem feitas', 37),
('Bar', 'Manipulação adequada de alimentos e bebidas', 38),

('Atendimento', 'Não há materiais ou utensílios em desuso no salão ou área de atendimento', 1),
('Atendimento', 'Não há itens sem identificação', 2),
('Atendimento', 'Não há caixas ou embalagens desnecessárias no espaço', 3),
('Atendimento', 'Todos os itens possuem local definido', 4),
('Atendimento', 'Materiais de atendimento organizados e de fácil acesso', 5),
('Atendimento', 'Todos os itens estão etiquetados', 6),
('Atendimento', 'Salões encontram-se limpos e organizados', 7),
('Atendimento', 'Sanitários estão limpos, organizados e munidos de suprimentos', 8),
('Atendimento', 'Lixeiras limpas, identificadas e com abertura por pedal', 9),
('Atendimento', 'Piso limpo e seco em toda a área de atendimento', 10),
('Atendimento', 'Equipe do atendimento com uniforme completo', 11),
('Atendimento', 'Equipe do atendimento usa touca ao adentrar a cozinha', 12),
('Atendimento', 'POPs de atendimento disponíveis e sendo seguidos', 13),
('Atendimento', 'Checklists de abertura e fechamento utilizados', 14),
('Atendimento', 'Equipe conhece os padrões de atendimento', 15),
('Atendimento', 'Equipe acata as melhorias prontamente', 16),
('Atendimento', 'Rotina de organização e limpeza do salão sendo cumprida', 17),
('Atendimento', 'Não conformidades antigas resolvidas', 18),
('Atendimento', 'Líder acompanha execução do serviço', 19),
('Atendimento', 'Treinamentos realizados (caso haja colaborador sem curso de boas práticas, o líder já comunicou a nutricionista?)', 20),
('Atendimento', 'Uniformes e higiene adequados', 21),
('Atendimento', 'Higienização correta das mãos antes de manipular qualquer item', 22),
('Atendimento', 'Equipe sem adornos, unhas curtas sem esmalte, sem cílios postiços, barbas bem feitas', 23),
('Atendimento', 'Manipulação adequada de alimentos e bebidas no serviço', 24),
('Atendimento', 'Ausência de contaminação cruzada entre itens servidos', 25);
