// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";
var getEnv = (key) => {
  if (typeof process !== "undefined" && process.env) return process.env[key] || "";
  return "";
};
var supabaseUrl = getEnv("SUPABASE_URL");
var supabaseKey = getEnv("SUPABASE_ANON_KEY");
var isServerSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder") && !supabaseUrl.includes("MY_SUPABASE")
);
var serverClientInstance = null;
function getServerSupabaseClient(accessToken) {
  if (!isServerSupabaseConfigured) return null;
  if (accessToken) {
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }
  if (!serverClientInstance) {
    serverClientInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return serverClientInstance;
}
async function verifySupabaseToken(token) {
  const client = getServerSupabaseClient();
  if (!client) return { valid: false, code: "SUPABASE_NOT_CONFIGURED" };
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return { valid: false, status: error?.status, code: error?.code };
    }
    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata
      }
    };
  } catch (error) {
    return {
      valid: false,
      status: error?.status,
      code: error?.code || error?.name || "AUTH_REQUEST_FAILED"
    };
  }
}
async function getAuthorizedAdmin(token) {
  const identity = await verifySupabaseToken(token);
  if (!identity.valid || !identity.user?.id) {
    const isAuthRejection = identity.status !== void 0 && identity.status >= 400 && identity.status < 500;
    return isAuthRejection ? { status: "unauthorized", stage: "auth", upstreamStatus: identity.status, code: identity.code } : { status: "unavailable", stage: "auth", upstreamStatus: identity.status, code: identity.code };
  }
  let adminCheckResponse;
  try {
    adminCheckResponse = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
  } catch (error) {
    return {
      status: "unavailable",
      stage: "admins-query",
      upstreamStatus: 503,
      code: error?.code || error?.name || "RPC_REQUEST_FAILED"
    };
  }
  if (!adminCheckResponse.ok) {
    const errorBody = await adminCheckResponse.json().catch(() => ({}));
    return {
      status: "unavailable",
      stage: "admins-query",
      upstreamStatus: adminCheckResponse.status >= 500 ? 503 : 500,
      code: errorBody.code || `HTTP_${adminCheckResponse.status}`
    };
  }
  const isAdmin = await adminCheckResponse.json();
  if (isAdmin !== true) {
    return { status: "forbidden", authUserId: identity.user.id };
  }
  const email = identity.user.email || "";
  const metadata = identity.user.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.display_name || email;
  return {
    status: "authorized",
    user: { id: identity.user.id, email, name, role: "admin" }
  };
}

// src/server/repository.ts
var RepositoryError = class extends Error {
  constructor(operation) {
    super(`Supabase operation failed: ${operation}`);
    this.name = "RepositoryError";
  }
};
function fail(operation, error) {
  console.error(`[repository] ${operation} failed code=${error.code || "unknown"}`);
  throw new RepositoryError(operation);
}
var mapStore = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description || "",
  logoUrl: row.logo_url || "",
  isActive: Boolean(row.is_active),
  distributionMode: row.distribution_mode || "automatic",
  manualActiveGroupId: row.manual_active_group_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
var mapGroup = (row, includePrivateFields = true) => ({
  id: includePrivateFields ? row.id || "" : "",
  storeId: row.store_id,
  name: includePrivateFields ? row.name || "" : "",
  inviteUrl: includePrivateFields ? row.invite_url || "" : "",
  clickLimit: row.click_limit,
  currentClicks: row.current_clicks,
  displayOrder: includePrivateFields ? row.display_order : 0,
  isActive: Boolean(row.is_active),
  createdAt: includePrivateFields ? row.created_at : "",
  updatedAt: includePrivateFields ? row.updated_at : ""
});
var VipRepository = class {
  constructor(client, adminContext = false) {
    this.client = client;
    this.adminContext = adminContext;
  }
  async listAll(table, select, operation) {
    const pageSize = 1e3;
    const rows = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client.from(table).select(select).range(from, from + pageSize - 1);
      if (error) fail(operation, error);
      rows.push(...data || []);
      if (!data || data.length < pageSize) return rows;
    }
  }
  async getStores() {
    const { data, error } = await this.client.from("stores").select("*").order("name");
    if (error) fail("get_stores", error);
    return (data || []).map(mapStore);
  }
  async getStoreBySlug(slug) {
    const columns = this.adminContext ? "*" : "id,name,slug,description,logo_url,is_active";
    const { data, error } = await this.client.from("stores").select(columns).eq("slug", slug).maybeSingle();
    if (error) fail("get_store_by_slug", error);
    return data ? mapStore(data) : void 0;
  }
  async getStoreById(id) {
    const { data, error } = await this.client.from("stores").select("*").eq("id", id).maybeSingle();
    if (error) fail("get_store_by_id", error);
    return data ? mapStore(data) : void 0;
  }
  async createStore(input) {
    const slug = input.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");
    const { data, error } = await this.client.from("stores").insert({
      name: input.name.trim(),
      slug,
      description: input.description || "",
      logo_url: input.logoUrl || "",
      is_active: input.isActive ?? true,
      distribution_mode: input.distributionMode || "automatic"
    }).select("*").single();
    if (error) fail("create_store", error);
    const { error: groupError } = await this.client.from("vip_groups").insert({
      store_id: data.id,
      name: `Grupo VIP 01 - ${data.name}`,
      invite_url: "https://chat.whatsapp.com/invite/ExemploVipLink",
      click_limit: 800,
      current_clicks: 0,
      display_order: 1,
      is_active: true
    });
    if (groupError) {
      await this.client.from("stores").delete().eq("id", data.id);
      fail("create_initial_group", groupError);
    }
    return mapStore(data);
  }
  async updateStore(id, updates) {
    const patch = {};
    if (updates.name !== void 0) patch.name = updates.name.trim();
    if (updates.slug !== void 0) patch.slug = updates.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");
    if (updates.description !== void 0) patch.description = updates.description.trim();
    if (updates.logoUrl !== void 0) patch.logo_url = updates.logoUrl.trim();
    if (updates.isActive !== void 0) patch.is_active = Boolean(updates.isActive);
    if (updates.distributionMode !== void 0) patch.distribution_mode = updates.distributionMode;
    if (updates.manualActiveGroupId !== void 0) patch.manual_active_group_id = updates.manualActiveGroupId;
    patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await this.client.from("stores").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) fail("update_store", error);
    if (!data) throw new Error("Loja n\xE3o encontrada");
    return mapStore(data);
  }
  async deleteStore(id) {
    const { data, error } = await this.client.from("stores").delete().eq("id", id).select("id");
    if (error) fail("delete_store", error);
    return Boolean(data?.length);
  }
  async getGroupsByStore(storeId) {
    const columns = this.adminContext ? "*" : "store_id,is_active,click_limit,current_clicks";
    let query = this.client.from("vip_groups").select(columns).eq("store_id", storeId);
    if (this.adminContext) query = query.order("display_order").order("created_at");
    const { data, error } = await query;
    if (error) fail("get_groups_by_store", error);
    return (data || []).map((row) => mapGroup(row, this.adminContext));
  }
  async getGroupById(id) {
    const { data, error } = await this.client.from("vip_groups").select("*").eq("id", id).maybeSingle();
    if (error) fail("get_group_by_id", error);
    return data ? mapGroup(data) : void 0;
  }
  async createGroup(input) {
    const store = await this.getStoreById(input.storeId);
    if (!store) throw new Error("Loja n\xE3o encontrada");
    const groups = await this.getGroupsByStore(input.storeId);
    const displayOrder = input.displayOrder ?? (groups.length ? Math.max(...groups.map((g) => g.displayOrder)) + 1 : 1);
    const { data, error } = await this.client.from("vip_groups").insert({
      store_id: input.storeId,
      name: input.name.trim(),
      invite_url: input.inviteUrl.trim(),
      click_limit: Math.max(1, Number(input.clickLimit) || 800),
      display_order: displayOrder,
      is_active: input.isActive ?? true
    }).select("*").single();
    if (error) fail("create_group", error);
    return mapGroup(data);
  }
  async updateGroup(id, updates) {
    const patch = {};
    if (updates.name !== void 0) patch.name = updates.name.trim();
    if (updates.inviteUrl !== void 0) patch.invite_url = updates.inviteUrl.trim();
    if (updates.clickLimit !== void 0) patch.click_limit = Math.max(1, Number(updates.clickLimit) || 800);
    if (updates.displayOrder !== void 0) patch.display_order = Number(updates.displayOrder);
    if (updates.isActive !== void 0) patch.is_active = Boolean(updates.isActive);
    if (updates.currentClicks !== void 0) patch.current_clicks = Math.max(0, Number(updates.currentClicks));
    patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await this.client.from("vip_groups").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) fail("update_group", error);
    if (!data) throw new Error("Grupo n\xE3o encontrado");
    return mapGroup(data);
  }
  async deleteGroup(id) {
    const { data, error } = await this.client.from("vip_groups").delete().eq("id", id).select("id");
    if (error) fail("delete_group", error);
    return Boolean(data?.length);
  }
  async resetGroupClicks(id) {
    const { data, error } = await this.client.from("vip_groups").update({ current_clicks: 0, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select("*").maybeSingle();
    if (error) fail("reset_group_clicks", error);
    if (!data) throw new Error("Grupo n\xE3o encontrado");
    return mapGroup(data);
  }
  async recordAccess(storeId, visitorHash, userAgent, referrer) {
    const { error } = await this.client.from("access_events").insert({
      store_id: storeId,
      visitor_hash: visitorHash,
      user_agent: userAgent || null,
      referrer: referrer || null
    });
    if (error) fail("record_access", error);
  }
  async routeAndIncrementClick(slug, idempotencyKey, visitorHash = "anon") {
    const { data, error } = await this.client.rpc("route_vip_click_atomic", {
      p_store_slug: slug,
      p_idempotency_key: idempotencyKey || null,
      p_visitor_hash: visitorHash
    });
    if (error) fail("route_vip_click_atomic", error);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error("Supabase returned no distribution result");
    return {
      success: Boolean(result.success),
      inviteUrl: result.invite_url || void 0,
      groupName: result.group_name || void 0,
      groupId: result.group_id || void 0,
      error: result.error_message || void 0
    };
  }
  async getDistributionSettings() {
    const { data, error } = await this.client.from("distribution_settings").select("key,value");
    if (error) fail("get_distribution_settings", error);
    return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  }
  async getDashboardMetrics() {
    const [stores, groups, accessCount, clickCount, recentResult] = await Promise.all([
      this.getStores(),
      this.listAll("vip_groups", "*", "get_metrics_groups"),
      this.client.from("access_events").select("id", { count: "exact", head: true }),
      this.client.from("click_events").select("id", { count: "exact", head: true }),
      this.client.from("click_events").select("id,store_id,group_id,visitor_hash,created_at,stores(name),vip_groups(name)").order("created_at", { ascending: false }).limit(50)
    ]);
    if (accessCount.error) fail("count_access_events", accessCount.error);
    if (clickCount.error) fail("count_click_events", clickCount.error);
    if (recentResult.error) fail("get_recent_click_events", recentResult.error);
    const accessByStore = await Promise.all(stores.map(async (store) => {
      const { count, error } = await this.client.from("access_events").select("id", { count: "exact", head: true }).eq("store_id", store.id);
      if (error) fail("count_store_access_events", error);
      return [store.id, count || 0];
    }));
    const clicksByStore = await Promise.all(stores.map(async (store) => {
      const { count, error } = await this.client.from("click_events").select("id", { count: "exact", head: true }).eq("store_id", store.id);
      if (error) fail("count_store_click_events", error);
      return [store.id, count || 0];
    }));
    const accessMap = new Map(accessByStore);
    const clickMap = new Map(clicksByStore);
    const groupsByStore = /* @__PURE__ */ new Map();
    const mappedGroups = groups.map((row) => mapGroup(row));
    for (const group of mappedGroups) groupsByStore.set(group.storeId, [...groupsByStore.get(group.storeId) || [], group]);
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const storeMetrics = stores.map((store) => {
      const storeGroups = groupsByStore.get(store.id) || [];
      const totalAccesses2 = accessMap.get(store.id) || 0;
      const totalClicks2 = clickMap.get(store.id) || 0;
      const activeGroup = store.distributionMode === "manual" ? storeGroups.find((group) => group.id === store.manualActiveGroupId) : storeGroups.find((group) => group.isActive && group.currentClicks < group.clickLimit);
      return {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        isActive: store.isActive,
        totalAccesses: totalAccesses2,
        totalClicks: totalClicks2,
        conversionRate: totalAccesses2 ? Number((totalClicks2 / totalAccesses2 * 100).toFixed(1)) : 0,
        activeGroupName: activeGroup?.name || "Nenhum ativo",
        totalGroups: storeGroups.length,
        fullGroups: storeGroups.filter((group) => group.currentClicks >= group.clickLimit).length
      };
    });
    const groupMetrics = mappedGroups.map((group) => {
      const store = storeById.get(group.storeId);
      const storeGroups = groupsByStore.get(group.storeId) || [];
      const target = store?.distributionMode === "manual" ? store.manualActiveGroupId : storeGroups.find((candidate) => candidate.isActive && candidate.currentClicks < candidate.clickLimit)?.id;
      return {
        groupId: group.id,
        storeId: group.storeId,
        storeName: store?.name || "Desconhecida",
        groupName: group.name,
        inviteUrl: group.inviteUrl,
        clickLimit: group.clickLimit,
        currentClicks: group.currentClicks,
        displayOrder: group.displayOrder,
        isActive: group.isActive,
        isCurrentRoutingTarget: Boolean(store?.isActive && group.isActive && target === group.id),
        percentFull: Math.min(100, Number((group.currentClicks / group.clickLimit * 100).toFixed(1)))
      };
    });
    const recentEvents = (recentResult.data || []).map((row) => ({
      id: row.id,
      storeName: row.stores?.name || "Loja",
      groupName: row.vip_groups?.name || "Grupo VIP",
      createdAt: row.created_at,
      visitorHash: row.visitor_hash || "an\xF4nimo"
    }));
    const totalAccesses = accessCount.count || 0;
    const totalClicks = clickCount.count || 0;
    return {
      totalAccesses,
      totalClicks,
      conversionRate: totalAccesses ? Number((totalClicks / totalAccesses * 100).toFixed(1)) : 0,
      totalStores: stores.length,
      activeStores: stores.filter((store) => store.isActive).length,
      storeMetrics,
      groupMetrics,
      recentEvents
    };
  }
  async simulateClicks(storeSlug, count) {
    let added = 0;
    let lastGroup = "";
    for (let i = 0; i < count; i += 1) {
      const result = await this.routeAndIncrementClick(storeSlug, `simulation-${crypto.randomUUID()}`, "simulado");
      if (!result.success) break;
      added += 1;
      lastGroup = result.groupName || "";
    }
    return { added, lastGroup };
  }
};
function createRepository(accessToken) {
  const client = getServerSupabaseClient(accessToken);
  if (!client) throw new Error("Supabase is not configured");
  return new VipRepository(client, Boolean(accessToken));
}
var repository = new Proxy({}, {
  get(_target, property) {
    const instance = createRepository();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var repositoryErrorStatus = (error, fallback) => error instanceof RepositoryError ? 503 : fallback;
async function createApp() {
  const app = express();
  app.use(express.json());
  const requireAdmin = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) {
      console.info(`[admin-auth] ${req.method} ${req.path} status=401 reason=missing_bearer`);
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!isServerSupabaseConfigured) {
      console.error(`[admin-auth] ${req.method} ${req.path} status=503 reason=supabase_not_configured`);
      res.status(503).json({ error: "Supabase is not configured." });
      return;
    }
    try {
      const result = await getAuthorizedAdmin(header.slice(7).trim());
      if (result.status === "unauthorized") {
        console.info(`[admin-auth] ${req.method} ${req.path} status=401 reason=invalid_session`);
        res.status(401).json({ error: "Session invalid or expired." });
        return;
      }
      if (result.status === "forbidden") {
        console.info(`[admin-auth] ${req.method} ${req.path} status=403 reason=not_admin auth_user_id=${result.authUserId}`);
        res.status(403).json({ error: "Administrator access required." });
        return;
      }
      if (result.status !== "authorized") {
        const status = result.upstreamStatus === 500 ? 500 : 503;
        console.error(`[admin-auth] ${req.method} ${req.path} status=${status} stage=${result.stage} code=${result.code || "unknown"}`);
        res.status(status).json({ error: "Unable to check administrator access." });
        return;
      }
      req.adminUser = result.user;
      req.repository = createRepository(header.slice(7).trim());
      next();
    } catch (error) {
      const code = error?.code || error?.name || "unknown";
      console.error(`[admin-auth] ${req.method} ${req.path} status=503 stage=unexpected code=${code}`);
      res.status(503).json({ error: "Unable to validate Supabase session." });
    }
  };
  app.get("/api/public/store/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const store = await repository.getStoreBySlug(slug);
      if (!store) {
        res.status(404).json({ error: "Loja n\xE3o encontrada." });
        return;
      }
      const visitorHash = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "visitor";
      const userAgent = req.headers["user-agent"];
      const referrer = req.headers["referer"];
      if (req.query.track !== "0") {
        await repository.recordAccess(store.id, visitorHash, userAgent, referrer);
      }
      const groups = await repository.getGroupsByStore(store.id);
      const hasActiveGroups = groups.some((g) => g.isActive && g.currentClicks < g.clickLimit);
      res.json({
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: store.description,
        logoUrl: store.logoUrl,
        isActive: store.isActive,
        hasAvailableGroups: hasActiveGroups
      });
    } catch (err) {
      console.error("Erro em /api/public/store/:slug:", err);
      res.status(repositoryErrorStatus(err, 500)).json({ error: "Erro interno ao consultar loja." });
    }
  });
  app.post("/api/public/store/:slug/join", async (req, res) => {
    try {
      const { slug } = req.params;
      const { idempotencyKey, visitorHash } = req.body || {};
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "client";
      const hash = visitorHash || `ip-${ip.substring(0, 16)}`;
      const result = await repository.routeAndIncrementClick(slug, idempotencyKey, hash);
      if (!result.success) {
        res.status(400).json({
          error: result.error || "N\xE3o foi poss\xEDvel encontrar um grupo dispon\xEDvel no momento."
        });
        return;
      }
      res.json({
        success: true,
        inviteUrl: result.inviteUrl,
        groupName: result.groupName,
        message: "Redirecionando para o WhatsApp..."
      });
    } catch (err) {
      console.error("Erro em /api/public/store/:slug/join:", err);
      res.status(repositoryErrorStatus(err, 500)).json({ error: "Erro interno no direcionamento at\xF4mico." });
    }
  });
  app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.json({ status: "authenticated", user: req.adminUser });
  });
  app.post("/api/admin/verify-admin-session", requireAdmin, (req, res) => {
    res.json({ authorized: true, user: req.adminUser });
  });
  app.get("/api/admin/stores", requireAdmin, async (req, res) => {
    try {
      res.json(await req.repository.getStores());
    } catch {
      res.status(503).json({ error: "N\xE3o foi poss\xEDvel consultar as unidades." });
    }
  });
  app.post("/api/admin/stores", requireAdmin, async (req, res) => {
    try {
      const { name, slug, description, logoUrl, isActive, distributionMode } = req.body;
      if (!name || !slug) {
        res.status(400).json({ error: "Nome da loja e slug s\xE3o obrigat\xF3rios." });
        return;
      }
      const store = await req.repository.createStore({
        name,
        slug,
        description,
        logoUrl,
        isActive,
        distributionMode
      });
      res.status(201).json(store);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel salvar a unidade." : err.message || "Erro ao criar loja." });
    }
  });
  app.put("/api/admin/stores/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await req.repository.updateStore(id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel atualizar a unidade." : err.message || "Erro ao atualizar loja." });
    }
  });
  app.delete("/api/admin/stores/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await req.repository.deleteStore(id);
      if (!success) {
        res.status(404).json({ error: "Loja n\xE3o encontrada." });
        return;
      }
      res.json({ success: true, message: "Loja removida com sucesso." });
    } catch (err) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: "Erro ao remover loja." });
    }
  });
  app.get("/api/admin/stores/:storeId/groups", requireAdmin, async (req, res) => {
    const { storeId } = req.params;
    try {
      res.json(await req.repository.getGroupsByStore(storeId));
    } catch {
      res.status(503).json({ error: "N\xE3o foi poss\xEDvel consultar os grupos." });
    }
  });
  app.post("/api/admin/groups", requireAdmin, async (req, res) => {
    try {
      const { storeId, name, inviteUrl, clickLimit, displayOrder, isActive } = req.body;
      if (!storeId || !name || !inviteUrl) {
        res.status(400).json({ error: "Loja, nome do grupo e link de convite s\xE3o obrigat\xF3rios." });
        return;
      }
      const group = await req.repository.createGroup({
        storeId,
        name,
        inviteUrl,
        clickLimit,
        displayOrder,
        isActive
      });
      res.status(201).json(group);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel cadastrar o grupo." : err.message || "Erro ao cadastrar grupo." });
    }
  });
  app.put("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const group = await req.repository.updateGroup(id, req.body);
      res.json(group);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel atualizar o grupo." : err.message || "Erro ao atualizar grupo." });
    }
  });
  app.delete("/api/admin/groups/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await req.repository.deleteGroup(id);
      if (!success) {
        res.status(404).json({ error: "Grupo n\xE3o encontrado." });
        return;
      }
      res.json({ success: true, message: "Grupo removido com sucesso." });
    } catch (err) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: "Erro ao remover grupo." });
    }
  });
  app.post("/api/admin/groups/:id/reset-clicks", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const group = await req.repository.resetGroupClicks(id);
      res.json(group);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel zerar os cliques." : err.message || "Erro ao zerar cliques do grupo." });
    }
  });
  app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
    try {
      const metrics = await req.repository.getDashboardMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: "Erro ao calcular relat\xF3rios." });
    }
  });
  app.post("/api/admin/simulate", requireAdmin, async (req, res) => {
    try {
      const { storeSlug, count } = req.body;
      const num = Math.min(1e3, Math.max(1, Number(count) || 10));
      const result = await req.repository.simulateClicks(storeSlug, num);
      res.json({
        success: true,
        message: `Simulados ${result.added} cliques na loja ${storeSlug}.`,
        lastGroup: result.lastGroup
      });
    } catch (err) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? "N\xE3o foi poss\xEDvel simular a distribui\xE7\xE3o." : err.message || "Erro na simula\xE7\xE3o." });
    }
  });
  app.get("/api/admin/qrcode/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const format = req.query.format === "svg" ? "svg" : "png";
      const download = req.query.download === "1";
      const deploymentUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || (process.env.VERCEL_ENV === "preview" ? process.env.VERCEL_URL : "");
      const configuredUrl = process.env.APP_URL || (deploymentUrl ? `https://${deploymentUrl}` : "");
      const fallbackUrl = process.env.NODE_ENV === "production" ? "" : `${req.protocol}://${req.get("host") || "localhost:3000"}`;
      const rawAppUrl = configuredUrl || fallbackUrl;
      const appUrl = (/^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : `https://${rawAppUrl}`).replace(/\/$/, "");
      if (!appUrl || process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/i.test(appUrl)) {
        res.status(503).json({ error: "A URL p\xFAblica do sistema n\xE3o est\xE1 configurada." });
        return;
      }
      const targetUrl = `${appUrl}/vip/${slug}`;
      if (format === "svg") {
        const svgString = await QRCode.toString(targetUrl, {
          type: "svg",
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff"
          }
        });
        res.setHeader("Content-Type", "image/svg+xml");
        if (download) {
          res.setHeader("Content-Disposition", `attachment; filename="qrcode-vip-${slug}.svg"`);
        }
        res.send(svgString);
      } else {
        const buffer = await QRCode.toBuffer(targetUrl, {
          type: "png",
          width: 800,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff"
          }
        });
        res.setHeader("Content-Type", "image/png");
        if (download) {
          res.setHeader("Content-Disposition", `attachment; filename="qrcode-vip-${slug}.png"`);
        }
        res.send(buffer);
      }
    } catch (err) {
      console.error("Erro ao gerar QRCode:", err);
      res.status(500).json({ error: "Erro ao gerar QR Code." });
    }
  });
  app.use("/api", (req, res) => {
    console.info(`[api] ${req.method} ${req.path} status=404 reason=route_not_found`);
    res.status(404).json({ error: "API route not found." });
  });
  if (process.env.NODE_ENV !== "production") {
    const viteModuleName = "vite";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  return app;
}
var isVercelRuntime = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
if (!isVercelRuntime && process.env.NODE_ENV !== "production" && process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const PORT = Number(process.env.PORT) || 3e3;
  createApp().then((app) => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Sistema VIP] Servidor rodando na porta ${PORT}`);
    });
  }).catch((err) => {
    console.error("[Sistema VIP] Falha cr\xEDtica ao iniciar servidor:", err?.name || "unknown");
    process.exit(1);
  });
}

// src/server/vercel-handler.ts
var appPromise;
async function handler(req, res) {
  const rewrittenUrl = new URL(req.url || "/", "http://vercel.internal");
  const originalPath = rewrittenUrl.searchParams.get("__path");
  if (!originalPath || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(originalPath)) {
    res.statusCode = originalPath ? 400 : 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "API route not found." }));
    return;
  }
  rewrittenUrl.searchParams.delete("__path");
  const query = rewrittenUrl.searchParams.toString();
  req.url = `/api/${originalPath}${query ? `?${query}` : ""}`;
  try {
    const app = await (appPromise ||= createApp());
    app(req, res);
  } catch (error) {
    console.error(`[vercel-api] express initialization failed code=${error?.name || "unknown"}`);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "API indispon\xEDvel no momento." }));
    }
  }
}
export {
  handler as default
};
