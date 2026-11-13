-- Restricted grants for the public API and authenticated admin API.
-- Requires public repository queries to select only the listed columns.
-- RLS policies remain enabled and unchanged; no admin table privileges are granted to anon.

-- Public store pages only need these non-sensitive fields.
GRANT SELECT (id, name, slug, description, logo_url, is_active)
ON TABLE public.stores TO anon;

-- Availability checks need capacity fields, never invite_url or group names.
GRANT SELECT (store_id, is_active, click_limit, current_clicks)
ON TABLE public.vip_groups TO anon;

-- Public access tracking may only populate these event fields.
GRANT INSERT (store_id, visitor_hash, user_agent, referrer)
ON TABLE public.access_events TO anon;

-- Authenticated role may reach admin table operations; RLS's is_admin() policies
-- continue to decide which authenticated user can read or change these rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stores, public.vip_groups
TO authenticated;
GRANT SELECT ON TABLE public.access_events, public.click_events
TO authenticated;

-- The anonymous join endpoint may call only the existing constrained RPC.
GRANT EXECUTE ON FUNCTION public.route_vip_click_atomic(character varying, character varying, character varying)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
