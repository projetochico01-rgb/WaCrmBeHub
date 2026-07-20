import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/whatsapp/encryption";
import { getEvolutionQr } from "@/lib/evolution/client";

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await db.from("profiles").select("account_id").eq("user_id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "Conta não encontrada" }, { status: 403 });
  const { data: config } = await db.from("evolution_config").select("api_url,encrypted_api_key,instance_name").eq("account_id", profile.account_id).single();
  if (!config?.encrypted_api_key) return NextResponse.json({ error: "Evolution não configurada" }, { status: 400 });
  try {
    const qr = await getEvolutionQr({ baseUrl: config.api_url, apiKey: decrypt(config.encrypted_api_key), instance: config.instance_name });
    return NextResponse.json(qr);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao obter QR Code" }, { status: 502 });
  }
}
