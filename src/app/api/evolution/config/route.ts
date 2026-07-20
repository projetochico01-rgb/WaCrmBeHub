import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/whatsapp/encryption";
import { getEvolutionConnection, setEvolutionWebhook } from "@/lib/evolution/client";

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
  const { data, error } = await ctx.db.from("evolution_config").select("id,api_url,instance_name,instance_id,integration_type,status,connected_phone,enabled,last_event_at,created_at,updated_at").eq("account_id", ctx.accountId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json();
  const apiUrl = String(body.api_url || "").trim().replace(/\/$/, "");
  const apiKey = String(body.api_key || "").trim();
  const instanceName = String(body.instance_name || "BeHub").trim();
  if (!apiUrl || !apiKey || !instanceName) return NextResponse.json({ error: "URL, chave e instância são obrigatórias" }, { status: 400 });

  const credentials = { baseUrl: apiUrl, apiKey, instance: instanceName };
  let connection: unknown;
  try {
    connection = await getEvolutionConnection(credentials);
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível validar a Evolution: ${error instanceof Error ? error.message : "erro"}` }, { status: 502 });
  }

  const { data, error } = await ctx.db.from("evolution_config").upsert({
    account_id: ctx.accountId,
    api_url: apiUrl,
    encrypted_api_key: encrypt(apiKey),
    instance_name: instanceName,
    integration_type: "WHATSAPP-BAILEYS",
    status: JSON.stringify(connection).toLowerCase().includes("open") ? "connected" : "connecting",
    enabled: true,
    created_by: ctx.user.id,
  }, { onConflict: "account_id" }).select("id,api_url,instance_name,status,enabled").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (secret && !origin.includes("localhost")) {
    await setEvolutionWebhook(credentials, `${origin}/api/evolution/webhook?secret=${encodeURIComponent(secret)}`);
  }
  return NextResponse.json({ config: data, connection });
}
