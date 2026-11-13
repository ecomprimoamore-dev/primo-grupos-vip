-- ==============================================================================
-- SISTEMA DE GRUPOS VIP - SUPABASE AUTH & POLÍTICAS RLS (ROW LEVEL SECURITY)
-- Arquivo: migrations/002_supabase_auth_and_rls.sql
-- ==============================================================================

-- 1. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_settings ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO AUXILIAR DE SEGURANÇA (SECURITY DEFINER)
-- Valida se o usuário autenticado no Supabase Auth está cadastrado na tabela de admins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admins 
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );
$$;

-- 3. POLÍTICAS RLS PARA A TABELA 'stores' (LOJAS)
-- Leitura pública: necessária para carregar as informações na página pública /vip/:slug
CREATE POLICY "Public read active stores"
ON public.stores
FOR SELECT
TO public, anon, authenticated
USING (is_active = true OR is_admin());

-- Modificação apenas por administradores autorizados
CREATE POLICY "Admin insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admin update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admin delete stores"
ON public.stores
FOR DELETE
TO authenticated
USING (is_admin());

-- 4. POLÍTICAS RLS PARA A TABELA 'vip_groups' (GRUPOS VIP)
-- Leitura pública: necessária para obter grupos ativos da unidade
CREATE POLICY "Public read active vip_groups"
ON public.vip_groups
FOR SELECT
TO public, anon, authenticated
USING (is_active = true OR is_admin());

-- Gestão completa restrita a administradores
CREATE POLICY "Admin manage vip_groups"
ON public.vip_groups
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 5. POLÍTICAS RLS PARA EVENTOS (ACCESS_EVENTS e CLICK_EVENTS)
-- Inserção pública permitida para registrar acessos e cliques no WhatsApp
CREATE POLICY "Public insert access_events"
ON public.access_events
FOR INSERT
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public insert click_events"
ON public.click_events
FOR INSERT
TO public, anon, authenticated
WITH CHECK (true);

-- Leitura de relatórios e métricas restrita aos administradores
CREATE POLICY "Admin read access_events"
ON public.access_events
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admin read click_events"
ON public.click_events
FOR SELECT
TO authenticated
USING (is_admin());

-- 6. POLÍTICAS RLS PARA A TABELA 'admins'
-- Apenas administradores autenticados podem consultar a lista de administradores
CREATE POLICY "Admin select admins"
ON public.admins
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admin manage admins"
ON public.admins
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 7. POLÍTICAS RLS PARA 'distribution_settings'
CREATE POLICY "Public read distribution settings"
ON public.distribution_settings
FOR SELECT
TO public, anon, authenticated
USING (true);

CREATE POLICY "Admin manage distribution settings"
ON public.distribution_settings
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
