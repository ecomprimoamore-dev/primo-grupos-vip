-- ==============================================================================
-- SISTEMA DE GRUPOS VIP - MIGRATION SUPABASE POSTGRESQL
-- Arquivo: migrations/001_create_vip_system_tables.sql
-- ==============================================================================

-- Habilita extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE LOJAS (STORES)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(80) UNIQUE NOT NULL,
    description TEXT DEFAULT 'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão.',
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    distribution_mode VARCHAR(20) NOT NULL DEFAULT 'automatic' CHECK (distribution_mode IN ('automatic', 'manual')),
    manual_active_group_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- 2. TABELA DE GRUPOS VIP (VIP_GROUPS)
CREATE TABLE IF NOT EXISTS vip_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    invite_url TEXT NOT NULL,
    click_limit INTEGER NOT NULL DEFAULT 800 CHECK (click_limit > 0),
    current_clicks INTEGER NOT NULL DEFAULT 0 CHECK (current_clicks >= 0),
    display_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_groups_store_order ON vip_groups(store_id, display_order);

-- Adiciona Foreign Key de manual_active_group_id para vip_groups
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_stores_manual_group'
    ) THEN
        ALTER TABLE stores 
        ADD CONSTRAINT fk_stores_manual_group 
        FOREIGN KEY (manual_active_group_id) REFERENCES vip_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. TABELA DE EVENTOS DE ACESSO (ACCESS_EVENTS)
-- Registra visualizações das páginas públicas de captação
CREATE TABLE IF NOT EXISTS access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    visitor_hash VARCHAR(64),
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_events_store_date ON access_events(store_id, created_at);

-- 4. TABELA DE EVENTOS DE CLIQUE / DIRECIONAMENTO (CLICK_EVENTS)
-- Registra cliques no botão de entrar no WhatsApp
CREATE TABLE IF NOT EXISTS click_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES vip_groups(id) ON DELETE CASCADE,
    visitor_hash VARCHAR(64),
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_events_store_group ON click_events(store_id, group_id);
CREATE INDEX IF NOT EXISTS idx_click_events_date ON click_events(created_at);

-- 5. TABELA DE ADMINISTRADORES (ADMINS)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE CONFIGURAÇÕES GERAIS (DISTRIBUTION_SETTINGS)
CREATE TABLE IF NOT EXISTS distribution_settings (
    key VARCHAR(80) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- FUNÇÃO ATÔMICA DE DIRECIONAMENTO E INCREMENTO COM ROW-LOCKING
-- Evita problemas de concorrência e acessos simultâneos
-- ==============================================================================

CREATE OR REPLACE FUNCTION route_vip_click_atomic(
    p_store_slug VARCHAR(80),
    p_idempotency_key VARCHAR(128) DEFAULT NULL,
    p_visitor_hash VARCHAR(64) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    invite_url TEXT,
    group_id UUID,
    group_name VARCHAR(150),
    error_message TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_store_id UUID;
    v_is_active BOOLEAN;
    v_distribution_mode VARCHAR(20);
    v_manual_group_id UUID;
    v_chosen_group RECORD;
    v_existing_click RECORD;
BEGIN
    -- 1. Verifica idempotência (para evitar contagem duplicada por falha de rede/duplo clique)
    IF p_idempotency_key IS NOT NULL THEN
        SELECT ce.group_id, vg.invite_url, vg.name INTO v_existing_click
        FROM click_events ce
        JOIN vip_groups vg ON ce.group_id = vg.id
        WHERE ce.idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN QUERY SELECT true, v_existing_click.invite_url, v_existing_click.group_id, v_existing_click.name, NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 2. Localiza a loja
    SELECT id, is_active, distribution_mode, manual_active_group_id
    INTO v_store_id, v_is_active, v_distribution_mode, v_manual_group_id
    FROM stores
    WHERE slug = p_store_slug;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::VARCHAR(150), 'Loja não encontrada'::TEXT;
        RETURN;
    END IF;

    IF NOT v_is_active THEN
        RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::VARCHAR(150), 'Esta unidade está temporariamente inativa'::TEXT;
        RETURN;
    END IF;

    -- 3. Seleção do grupo com base no modo
    IF v_distribution_mode = 'manual' AND v_manual_group_id IS NOT NULL THEN
        -- Modo Manual: seleciona o grupo específico configurado
        SELECT id, name, invite_url, current_clicks, click_limit
        INTO v_chosen_group
        FROM vip_groups
        WHERE id = v_manual_group_id AND is_active = true
        FOR UPDATE; -- Lock na linha para atomicidade

        IF NOT FOUND THEN
            RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::VARCHAR(150), 'O grupo manual configurado está inativo'::TEXT;
            RETURN;
        END IF;
    ELSE
        -- Modo Automático: busca o primeiro grupo ativo em ordem sequencial que ainda não atingiu o limite
        SELECT id, name, invite_url, current_clicks, click_limit
        INTO v_chosen_group
        FROM vip_groups
        WHERE store_id = v_store_id
          AND is_active = true
          AND current_clicks < click_limit
        ORDER BY display_order ASC, created_at ASC
        LIMIT 1
        FOR UPDATE; -- Row lock para concorrência segura

        -- Se todos atingiram o limite
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::VARCHAR(150), 'Todos os grupos VIP desta unidade atingiram a capacidade máxima'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 4. Incremento atômico
    UPDATE vip_groups
    SET current_clicks = current_clicks + 1,
        updated_at = NOW()
    WHERE id = v_chosen_group.id;

    -- 5. Registra o evento de clique
    INSERT INTO click_events (store_id, group_id, visitor_hash, idempotency_key)
    VALUES (v_store_id, v_chosen_group.id, p_visitor_hash, p_idempotency_key);

    -- 6. Retorna link de convite
    RETURN QUERY SELECT true, v_chosen_group.invite_url, v_chosen_group.id, v_chosen_group.name, NULL::TEXT;
END;
$$;

-- ==============================================================================
-- DADOS INICIAIS (SEED) PARA AS 3 UNIDADES OBRIGATÓRIAS
-- Barigui, Quadrata, Pátio
-- ==============================================================================

-- Loja 1: Barigui
INSERT INTO stores (id, name, slug, description, is_active, distribution_mode)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Barigui',
    'barigui',
    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão da unidade Barigui.',
    true,
    'automatic'
) ON CONFLICT (slug) DO NOTHING;

-- Loja 2: Quadrata
INSERT INTO stores (id, name, slug, description, is_active, distribution_mode)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'Quadrata',
    'quadrata',
    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão da unidade Quadrata.',
    true,
    'automatic'
) ON CONFLICT (slug) DO NOTHING;

-- Loja 3: Pátio
INSERT INTO stores (id, name, slug, description, is_active, distribution_mode)
VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'Pátio',
    'patio',
    'Receba ofertas exclusivas, promoções especiais e lançamentos em primeira mão da unidade Pátio.',
    true,
    'automatic'
) ON CONFLICT (slug) DO NOTHING;

-- Grupos VIP para Barigui (Exemplo com 3 grupos sequenciais, limite de 800 cliques cada)
INSERT INTO vip_groups (store_id, name, invite_url, click_limit, current_clicks, display_order, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Grupo VIP 01 - Barigui', 'https://chat.whatsapp.com/invite/BariguiVip01Exemplo', 800, 0, 1, true),
    ('a0000000-0000-0000-0000-000000000001', 'Grupo VIP 02 - Barigui', 'https://chat.whatsapp.com/invite/BariguiVip02Exemplo', 800, 0, 2, true),
    ('a0000000-0000-0000-0000-000000000001', 'Grupo VIP 03 - Barigui', 'https://chat.whatsapp.com/invite/BariguiVip03Exemplo', 800, 0, 3, true)
ON CONFLICT DO NOTHING;

-- Grupos VIP para Quadrata
INSERT INTO vip_groups (store_id, name, invite_url, click_limit, current_clicks, display_order, is_active)
VALUES 
    ('b0000000-0000-0000-0000-000000000002', 'Grupo VIP 01 - Quadrata', 'https://chat.whatsapp.com/invite/QuadrataVip01Exemplo', 800, 0, 1, true),
    ('b0000000-0000-0000-0000-000000000002', 'Grupo VIP 02 - Quadrata', 'https://chat.whatsapp.com/invite/QuadrataVip02Exemplo', 800, 0, 2, true)
ON CONFLICT DO NOTHING;

-- Grupos VIP para Pátio
INSERT INTO vip_groups (store_id, name, invite_url, click_limit, current_clicks, display_order, is_active)
VALUES 
    ('c0000000-0000-0000-0000-000000000003', 'Grupo VIP 01 - Pátio', 'https://chat.whatsapp.com/invite/PatioVip01Exemplo', 800, 0, 1, true),
    ('c0000000-0000-0000-0000-000000000003', 'Grupo VIP 02 - Pátio', 'https://chat.whatsapp.com/invite/PatioVip02Exemplo', 800, 0, 2, true)
ON CONFLICT DO NOTHING;

-- Configuração inicial de distribuição
INSERT INTO distribution_settings (key, value, description)
VALUES 
    ('click_grace_period_ms', '3000', 'Período de tolerância para debounce de cliques duplos'),
    ('default_click_limit', '800', 'Limite padrão de cliques por grupo')
ON CONFLICT DO NOTHING;
