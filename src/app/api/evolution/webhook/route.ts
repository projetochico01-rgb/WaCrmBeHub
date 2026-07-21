import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import { validEvolutionWebhookSecret } from "@/lib/evolution/webhook-secret";

// Evolution 2.3.x sends different nested shapes for text, media and status events.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

function digits(value: string) { return value.replace(/\D/g, ""); }

function messageContent(message: Json): { type: string; text: string | null; media: string | null } {
  if (message.conversation) return { type: "text", text: message.conversation, media: null };
  if (message.extendedTextMessage?.text) return { type: "text", text: message.extendedTextMessage.text, media: null };
  const options = [
    ["image", message.imageMessage], ["video", message.videoMessage],
    ["document", message.documentMessage], ["audio", message.audioMessage],
  ] as const;
  for (const [type, value] of options) {
    if (value) {
      const base64 = value.base64 || value.media || null;
      const media = base64 ? (String(base64).startsWith("data:") ? base64 : `data:${value.mimetype || "application/octet-stream"};base64,${base64}`) : value.url || null;
      return { type, text: value.caption || value.fileName || null, media };
    }
  }
  return { type: "text", text: "[Mensagem não suportada]", media: null };
}

export async function POST(request: Request) {
  const supplied = new URL(request.url).searchParams.get("secret");
  if (!supplied) return NextResponse.json({ error: "Webhook inválido" }, { status: 401 });

  const body = await request.json() as Json;
  const event = String(body.event || "").toUpperCase().replace(/[.-]/g, "_");
  const instanceName = String(body.instance || body.instanceName || body.data?.instance || "");
  const db = supabaseAdmin();
  const { data: config } = await db.from("evolution_config").select("account_id,instance_name").eq("instance_name", instanceName).maybeSingle();
  if (!config || !validEvolutionWebhookSecret(config.account_id, supplied)) {
    return NextResponse.json({ error: "Webhook inválido" }, { status: 401 });
  }

  if (event === "CONNECTION_UPDATE") {
    const state = String(body.data?.state || body.data?.status || "").toLowerCase();
    await db.from("evolution_config").update({ status: state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected", last_event_at: new Date().toISOString() }).eq("account_id", config.account_id);
    return NextResponse.json({ received: true });
  }

  if (event === "MESSAGES_UPDATE") {
    const externalId = body.data?.key?.id || body.data?.id;
    const rawStatus = String(body.data?.update?.status || body.data?.status || "").toLowerCase();
    const status = rawStatus.includes("read") ? "read" : rawStatus.includes("delivery") || rawStatus.includes("delivered") ? "delivered" : rawStatus.includes("error") ? "failed" : "sent";
    if (externalId) await db.from("messages").update({ status }).eq("provider", "evolution").eq("external_message_id", externalId);
    return NextResponse.json({ received: true });
  }

  if (event !== "MESSAGES_UPSERT") return NextResponse.json({ received: true });
  const data = body.data || {};
  const key = data.key || {};
  const remoteJid = String(key.remoteJid || data.remoteJid || "");
  if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("status@broadcast")) return NextResponse.json({ received: true });
  const phone = digits(remoteJid.split("@")[0]);
  const allowed = digits(process.env.BEHUB_ALLOWED_TEST_PHONE || "5547988976484");
  if (process.env.BEHUB_TEST_MODE !== "false" && phone !== allowed) return NextResponse.json({ received: true, ignored: "test_mode" });
  const externalId = String(key.id || data.id || "");
  if (!externalId) return NextResponse.json({ received: true });
  const { data: duplicate } = await db.from("messages").select("id").eq("provider", "evolution").eq("provider_instance", instanceName).eq("external_message_id", externalId).maybeSingle();
  if (duplicate) return NextResponse.json({ received: true, duplicate: true });

  let { data: contact } = await db.from("contacts").select("id").eq("account_id", config.account_id).eq("phone", phone).maybeSingle();
  if (!contact) {
    const { data: created } = await db.from("contacts").insert({ account_id: config.account_id, user_id: (await db.from("account_members").select("user_id").eq("account_id", config.account_id).eq("role", "owner").limit(1).single()).data?.user_id, phone, name: data.pushName || phone }).select("id").single();
    contact = created;
  }
  if (!contact) return NextResponse.json({ error: "Contato não criado" }, { status: 500 });
  let { data: conversation } = await db.from("conversations").select("id").eq("account_id", config.account_id).eq("contact_id", contact.id).maybeSingle();
  if (!conversation) {
    const owner = await db.from("account_members").select("user_id").eq("account_id", config.account_id).eq("role", "owner").limit(1).single();
    const created = await db.from("conversations").insert({ account_id: config.account_id, user_id: owner.data?.user_id, contact_id: contact.id }).select("id").single();
    conversation = created.data;
  }
  if (!conversation) return NextResponse.json({ error: "Conversa não criada" }, { status: 500 });

  const parsed = messageContent(data.message || {});
  const fromMe = Boolean(key.fromMe);
  await db.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: fromMe ? "agent" : "customer",
    content_type: parsed.type,
    content_text: parsed.text,
    media_url: parsed.media,
    message_id: externalId,
    external_message_id: externalId,
    provider: "evolution",
    provider_instance: instanceName,
    sent_by_type: fromMe ? "human" : null,
    status: "sent",
  });
  await db.from("conversations").update({
    last_message_text: parsed.text || `[${parsed.type}]`,
    last_message_at: new Date((Number(data.messageTimestamp) || Date.now() / 1000) * 1000).toISOString(),
    unread_count: fromMe ? 0 : 1,
    status: "open",
    updated_at: new Date().toISOString(),
    ...(fromMe
      ? { cadence_due_at: null, cadence_completed_at: new Date().toISOString() }
      : { cadence_step: 0, cadence_due_at: null, cadence_last_inbound_at: new Date().toISOString(), cadence_completed_at: null }),
  }).eq("id", conversation.id);
  await db.from("evolution_config").update({ last_event_at: new Date().toISOString() }).eq("account_id", config.account_id);
  return NextResponse.json({ received: true });
}
