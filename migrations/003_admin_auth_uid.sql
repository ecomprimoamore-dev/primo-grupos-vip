-- Link admin allowlist entries to the corresponding Supabase Auth identity.
-- Existing admins remain in place but must be explicitly linked before access is granted.
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.admins
  ALTER COLUMN password_hash DROP NOT NULL;

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
    WHERE auth_user_id = auth.uid()
  );
$$;

-- Admin users can inspect the allowlist; mutations remain available only through
-- trusted database administration, not through the application API.
DROP POLICY IF EXISTS "Admin manage admins" ON public.admins;
DROP POLICY IF EXISTS "Admin select admins" ON public.admins;
CREATE POLICY "Admin select admins"
ON public.admins FOR SELECT TO authenticated
USING (public.is_admin());
