import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/whatsapp/encryption";
import { getEvolutionConnection, getEvolutionInstanceDetails, setEvolutionWebhook } from "@/lib/evolution/client";
import { evolutionWebhookSecret } from "@/lib/evolution/webhook-secret";

async function context() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("account_id").eq("user_id", user.id).single();
  return profile?.account_id ? { db, user, accountId: profile.account_id as string } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data, error } = await ctx.db.from("evolution_config").select("id,api_url,encrypted_api_key,instance_name,instance_id,integration_type,status,connected_phone,enabled,last_event_at,created_at,updated_at").eq("account_id", ctx.accountId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ config: null });

  let status = data.status;
  let connectedPhone = data.connected_phone;
  let instanceId = data.instance_id;
  if (data.encrypted_api_key) {
    try {
      const live = await getEvolutionInstanceDetails({
        baseUrl: data.api_url,
        apiKey: decrypt(data.encrypted_api_key),
        instance: data.instance_name,
      });
      status = live?.status === "open" ? "connected" : live?.status === "connecting" ? "connecting" : "disconnected";
      connectedPhone = live?.connectedPhone ?? null;
      instanceId = live?.instanceId ?? data.instance_id;
      await ctx.db.from("evolution_config").update({
        status,
        connected_phone: connectedPhone,
        instance_id: instanceId,
      }).eq("account_id", ctx.accountId);
    } catch {
      status = "error";
    }
  }

  const { encrypted_api_key: _secret, ...publicConfig } = data;
  void _secret;
  return NextResponse.json({ config: { ...publicConfig, status, connected_phone: connectedPhone, instance_id: instanceId } });
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json();
  const apiUrl = String(body.api_url || "")
    .trim()
    .replace(/\/manager\/?$/i, "")
    .replace(/\/$/, "");
  const replacementApiKey = String(body.api_key || "").trim();
  const { data: existing } = await ctx.db
    .from("evolution_config")
    .select("encrypted_api_key")
    .eq("account_id", ctx.accountId)
    .maybeSingle();
  const apiKey = replacementApiKey || (existing?.encrypted_api_key
    ? decrypt(existing.encrypted_api_key)
    : "");
  const instanceName = String(body.instance_name || "BeHub").trim();
  if (!apiUrl || !apiKey || !instanceName) return NextResponse.json({ error: "URL, chave e instância são obrigatórias" }, { status: 400 });

  const credentials = { baseUrl: apiUrl, apiKey, instance: instanceName };
  let connection: unknown;
  let liveInstance: Awaited<ReturnType<typeof getEvolutionInstanceDetails>> = null;
  try {
    connection = await getEvolutionConnection(credentials);
    liveInstance = await getEvolutionInstanceDetails(credentials);
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível validar a Evolution: ${error instanceof Error ? error.message : "erro"}` }, { status: 502 });
  }

  const { data, error } = await ctx.db.from("evolution_config").upsert({
    account_id: ctx.accountId,
    api_url: apiUrl,
    encrypted_api_key: replacementApiKey
      ? encrypt(replacementApiKey)
      : existing?.encrypted_api_key,
    instance_name: instanceName,
    integration_type: "WHATSAPP-BAILEYS",
    instance_id: liveInstance?.instanceId,
    connected_phone: liveInstance?.connectedPhone,
    status: liveInstance?.status === "open" || JSON.stringify(connection).toLowerCase().includes("open") ? "connected" : "connecting",
    enabled: true,
    created_by: ctx.user.id,
  }, { onConflict: "account_id" }).select("id,api_url,instance_name,instance_id,status,connected_phone,enabled").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const secret = evolutionWebhookSecret(ctx.accountId);
  if (!origin.includes("localhost")) {
    await setEvolutionWebhook(credentials, `${origin}/api/evolution/webhook?secret=${encodeURIComponent(secret)}`);
  }
  return NextResponse.json({ config: data, connection });
}
